import { db } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "cellcity-dev-secret-change-in-production";
const SESSION_COOKIE = "cellcity-session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  companies: { id: string; name: string; slug: string; rank: string; plan: string }[];
  activeCompany?: { id: string; name: string; slug: string; rank: string; plan: string } | null;
}

// Simple base64 JWT-like token (no external jwt lib needed)
function encodeToken(payload: any): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from(JWT_SECRET).toString("base64url").slice(0, 16);
  return `${body}.${sig}`;
}

function decodeToken(token: string): any | null {
  try {
    const [body, sig] = token.split(".");
    const expectedSig = Buffer.from(JWT_SECRET).toString("base64url").slice(0, 16);
    if (sig !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support legacy plain-text hashes (from old seed) by comparing directly
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }
  return password === hash;
}

export async function createUserWithCompany(opts: {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone?: string;
}): Promise<AuthUser> {
  const existing = await db.user.findUnique({ where: { email: opts.ownerEmail } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await hashPassword(opts.ownerPassword);
  const slug = opts.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Create user + company + owner membership in a transaction
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: opts.ownerEmail,
        name: opts.ownerName,
        passwordHash,
        phone: opts.ownerPhone || null,
      },
    });
    const company = await tx.company.create({
      data: {
        name: opts.companyName,
        slug,
        ownerId: user.id,
        plan: "FREE",
      },
    });
    await tx.companyMembership.create({
      data: { userId: user.id, companyId: company.id, rank: "OWNER" },
    });
    return { user, company };
  });

  return {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    phone: result.user.phone,
    avatarUrl: result.user.avatarUrl,
    companies: [{ id: result.company.id, name: result.company.name, slug: result.company.slug, rank: "OWNER", plan: result.company.plan }],
    activeCompany: { id: result.company.id, name: result.company.name, slug: result.company.slug, rank: "OWNER", plan: result.company.plan },
  };
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: { include: { company: true } },
    },
  });
  if (!user) throw new Error("Invalid email or password");
  if (!user.active) throw new Error("Account is deactivated");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new Error("Invalid email or password");

  await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const companies = user.memberships
    .filter((m) => m.active && m.company.active)
    .map((m) => ({ id: m.company.id, name: m.company.name, slug: m.company.slug, rank: m.rank, plan: m.company.plan }));

  if (companies.length === 0) throw new Error("No active company membership");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    companies,
    activeCompany: companies[0],
  };
}

export function setSessionCookie(user: AuthUser): string {
  const token = encodeToken({ userId: user.id, companyId: user.activeCompany?.id, exp: Date.now() + 7 * 86400000 });
  return token;
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  if (payload.exp < Date.now()) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { memberships: { include: { company: true } } },
  });
  if (!user || !user.active) return null;

  const companies = user.memberships
    .filter((m) => m.active && m.company.active)
    .map((m) => ({ id: m.company.id, name: m.company.name, slug: m.company.slug, rank: m.rank, plan: m.company.plan }));

  if (companies.length === 0) return null;

  const activeCompany = companies.find((c) => c.id === payload.companyId) ?? companies[0];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    companies,
    activeCompany,
  };
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

// Re-export client-safe constants from auth-constants (so API routes can import from one place)
export { RANK_ORDER, RANK_LABELS, RANK_PERMISSIONS, hasPermission, isOwnerOrFounder } from "./auth-constants";
