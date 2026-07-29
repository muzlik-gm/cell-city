import { db } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "cellcity-dev-secret-change-in-production";
const SESSION_COOKIE = "cellcity-session";

export interface AuthSession {
  type: "app_user" | "employee";
  userId: string;       // AppUser.id or Employee.id
  businessId?: string;  // active business
  rank?: string;        // employee rank (for employee sessions)
  exp: number;
}

export interface AuthResult {
  type: "app_user" | "employee";
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  business?: {
    id: string;
    name: string;
    handle: string;
    plan: string;
  };
  rank?: string;
  businesses?: { id: string; name: string; handle: string; plan: string }[];
}

// Simple base64 token (no external jwt lib)
function encodeToken(payload: AuthSession): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from(JWT_SECRET).toString("base64url").slice(0, 16);
  return `${body}.${sig}`;
}

function decodeToken(token: string): AuthSession | null {
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
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }
  return password === hash;
}

// ── App User Registration (personal account — no business yet) ──────────
export async function registerAppUser(opts: {
  username: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<AuthResult> {
  const username = opts.username.toLowerCase().trim();
  const email = opts.email.toLowerCase().trim();

  const existingEmail = await db.appUser.findUnique({ where: { email } });
  if (existingEmail) throw new Error("Email already registered");
  const existingUsername = await db.appUser.findUnique({ where: { username } });
  if (existingUsername) throw new Error("Username already taken");

  const passwordHash = await hashPassword(opts.password);
  const user = await db.appUser.create({
    data: { username, email, name: opts.name, passwordHash, phone: opts.phone || null },
  });

  return {
    type: "app_user",
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    businesses: [],
  };
}

// ── App User Login ──────────────────────────────────────────────────────
export async function loginAppUser(identifier: string, password: string): Promise<AuthResult> {
  const id = identifier.toLowerCase().trim();
  const user = await db.appUser.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
  });
  if (!user) throw new Error("Invalid username/email or password");
  if (!user.active) throw new Error("Account is deactivated");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new Error("Invalid username/email or password");

  await db.appUser.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const businesses = await db.business.findMany({
    where: { ownerId: user.id, active: true },
    select: { id: true, name: true, handle: true, plan: true },
  });

  return {
    type: "app_user",
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    businesses,
    business: businesses[0],
  };
}

// ── Employee Login (business-scoped sub-account) ────────────────────────
export async function loginEmployee(businessHandle: string, username: string, password: string): Promise<AuthResult> {
  // Find the business by handle (any owner)
  const business = await db.business.findFirst({
    where: { handle: businessHandle.toLowerCase().trim(), active: true },
  });
  if (!business) throw new Error("Business not found");

  const employee = await db.employee.findUnique({
    where: { businessId_username: { businessId: business.id, username: username.toLowerCase().trim() } },
  });
  if (!employee) throw new Error("Invalid username or password");
  if (!employee.active) throw new Error("Account is deactivated");

  const valid = await verifyPassword(password, employee.passwordHash);
  if (!valid) throw new Error("Invalid username or password");

  await db.employee.update({ where: { id: employee.id }, data: { lastLogin: new Date() } });

  return {
    type: "employee",
    id: employee.id,
    username: employee.username,
    name: employee.name,
    phone: employee.phone,
    avatarUrl: employee.avatarUrl,
    rank: employee.rank,
    business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan },
  };
}

// ── Session Management ──────────────────────────────────────────────────
export function createSessionToken(session: AuthSession): string {
  return encodeToken({ ...session, exp: Date.now() + 7 * 86400000 });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getCurrentSession(): Promise<AuthResult | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || payload.exp < Date.now()) return null;

  if (payload.type === "app_user") {
    const user = await db.appUser.findUnique({ where: { id: payload.userId } });
    if (!user || !user.active) return null;
    const businesses = await db.business.findMany({
      where: { ownerId: user.id, active: true },
      select: { id: true, name: true, handle: true, plan: true },
    });
    const activeBusiness = businesses.find((b) => b.id === payload.businessId) ?? businesses[0];
    return {
      type: "app_user",
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      businesses,
      business: activeBusiness,
    };
  } else {
    // Employee session
    const employee = await db.employee.findUnique({
      where: { id: payload.userId },
      include: { business: true },
    });
    if (!employee || !employee.active) return null;
    return {
      type: "employee",
      id: employee.id,
      username: employee.username,
      name: employee.name,
      phone: employee.phone,
      avatarUrl: employee.avatarUrl,
      rank: employee.rank,
      business: { id: employee.business.id, name: employee.business.name, handle: employee.business.handle, plan: employee.business.plan },
    };
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

// Re-export client-safe constants
export { RANK_ORDER, RANK_LABELS, RANK_PERMISSIONS, hasPermission, isOwnerOrFounder } from "./auth-constants";
