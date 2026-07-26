import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/users — list users (id/name/role only, no password).
// Optional `?role=TECHNICIAN` to filter (used for technician assignment).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const activeOnly = searchParams.get("active") !== "false";

  const users = await db.user.findMany({
    where: {
      ...(activeOnly ? { active: true } : {}),
      ...(role ? { role } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      avatarUrl: true,
      active: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

// POST /api/users — create a new user (demo: stores a placeholder password hash).
export async function POST(req: NextRequest) {
  const { name, email, role, phone, passwordHash } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const user = await db.user.create({
    data: {
      name,
      email,
      role: role || "SALES_STAFF",
      phone: phone || null,
      passwordHash: passwordHash || "$2a$10$demo_placeholder_hash_replace_in_production",
    },
    select: { id: true, name: true, email: true, role: true, phone: true, avatarUrl: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
