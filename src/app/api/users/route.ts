import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";

// GET /api/users — list employees (id/name/rank only, no password).
// Optional `?role=TECHNICIAN` to filter (used for technician assignment).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const activeOnly = searchParams.get("active") !== "false";
  const businessId = await getBusinessId();

  const users = await db.employee.findMany({
    where: {
      businessId: businessId ?? "",
      ...(activeOnly ? { active: true } : {}),
      ...(role ? { rank: role } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      rank: true,
      phone: true,
      avatarUrl: true,
      active: true,
    },
    orderBy: [{ rank: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

// POST /api/users — create a new employee (demo: stores a placeholder password hash).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, role, phone, passwordHash } = body as {
    name?: string;
    email?: string;
    role?: string;
    phone?: string;
    passwordHash?: string;
  };
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const businessId = await getBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No business context" }, { status: 401 });
  }
  const existing = await db.employee.findUnique({
    where: { businessId_username: { businessId, username: email } },
  });
  if (existing) return NextResponse.json({ error: "Username already in use" }, { status: 409 });

  const user = await db.employee.create({
    data: {
      username: email,
      name,
      rank: role || "SALES_STAFF",
      phone: phone || null,
      passwordHash: passwordHash || "$2a$10$demo_placeholder_hash_replace_in_production",
      businessId,
    },
    select: { id: true, name: true, username: true, rank: true, phone: true, avatarUrl: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
