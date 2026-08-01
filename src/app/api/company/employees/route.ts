import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession, hashPassword, RANK_LABELS } from "@/lib/auth";
import { canManageEmployees } from "@/lib/auth-constants";

// GET /api/company/employees — list all employees in the active business
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.business) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employees = await db.employee.findMany({
    where: { businessId: session.business.id },
    orderBy: { createdAt: "desc" },
  });

  const result = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    rank: e.rank,
    rankLabel: RANK_LABELS[e.rank] ?? e.rank,
    active: e.active,
    joinedAt: e.createdAt,
    lastLogin: e.lastLogin,
  }));

  const canManage = session.type === "app_user" ? true : canManageEmployees(session.rank ?? "");
  return NextResponse.json({ employees: result, canManage });
}

// POST /api/company/employees — create a new employee sub-account
export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.business) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const isAppUser = session.type === "app_user";
  if (!isAppUser && !canManageEmployees(session.rank ?? "")) {
    return NextResponse.json({ error: "Only owners and managers can add employees" }, { status: 403 });
  }

  const { name, email, password, phone, rank } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (!RANK_LABELS[rank ?? "SALES_STAFF"]) {
    return NextResponse.json({ error: "Invalid rank" }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = await db.employee.findUnique({
    where: { businessId_email: { businessId: session.business.id, email: cleanEmail } },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already exists in this business" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const employee = await db.employee.create({
    data: {
      name,
      email: cleanEmail,
      passwordHash,
      phone: phone || null,
      rank: rank ?? "SALES_STAFF",
      businessId: session.business.id,
    },
  });

  return NextResponse.json({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    rank: employee.rank,
    rankLabel: RANK_LABELS[employee.rank],
  }, { status: 201 });
}
