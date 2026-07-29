import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, isOwnerOrFounder, RANK_LABELS } from "@/lib/auth";

// GET /api/company/employees — list all employees in the active company
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.activeCompany) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const memberships = await db.companyMembership.findMany({
    where: { companyId: user.activeCompany.id },
    include: { user: true },
    orderBy: { joinedAt: "desc" },
  });

  const employees = memberships.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    phone: m.user.phone,
    rank: m.rank,
    rankLabel: RANK_LABELS[m.rank] ?? m.rank,
    active: m.active,
    joinedAt: m.joinedAt,
    lastLogin: m.user.lastLogin,
  }));

  return NextResponse.json({ employees, canManage: isOwnerOrFounder(user.activeCompany.rank) });
}

// POST /api/company/employees — invite/add a new employee
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.activeCompany) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwnerOrFounder(user.activeCompany.rank)) {
    return NextResponse.json({ error: "Only owners and founders can add employees" }, { status: 403 });
  }

  const { name, email, password, phone, rank } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (!RANK_LABELS[rank ?? "SALES_STAFF"]) {
    return NextResponse.json({ error: "Invalid rank" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // If user already exists, just add membership
    const existingMembership = await db.companyMembership.findUnique({
      where: { userId_companyId: { userId: existing.id, companyId: user.activeCompany.id } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "Employee already in this company" }, { status: 409 });
    }
    const membership = await db.companyMembership.create({
      data: { userId: existing.id, companyId: user.activeCompany.id, rank: rank ?? "SALES_STAFF" },
    });
    return NextResponse.json({ id: membership.id, name: existing.name, email: existing.email, rank: membership.rank }, { status: 201 });
  }

  const passwordHash = await hashPassword(password);
  const result = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({ data: { email, name, passwordHash, phone: phone || null } });
    const membership = await tx.companyMembership.create({
      data: { userId: newUser.id, companyId: user.activeCompany.id, rank: rank ?? "SALES_STAFF" },
    });
    return { newUser, membership };
  });

  return NextResponse.json({
    id: result.membership.id,
    userId: result.newUser.id,
    name: result.newUser.name,
    email: result.newUser.email,
    phone: result.newUser.phone,
    rank: result.membership.rank,
    rankLabel: RANK_LABELS[result.membership.rank],
  }, { status: 201 });
}
