import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, createSessionToken, SESSION_COOKIE, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/business — App User creates a new business workspace
export async function POST(req: NextRequest) {
  const { name, handle } = await req.json();
  const session = await getCurrentSession();
  if (!session || session.type !== "app_user") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!name || !handle) {
    return NextResponse.json({ error: "Business name and handle are required" }, { status: 400 });
  }

  const cleanHandle = handle.toLowerCase().trim().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  if (cleanHandle.length < 3) {
    return NextResponse.json({ error: "Handle must be at least 3 characters (letters, numbers, hyphens)" }, { status: 400 });
  }

  // Check handle uniqueness for this owner
  const existing = await db.business.findFirst({
    where: { ownerId: session.id, handle: cleanHandle },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a business with this handle" }, { status: 409 });
  }

  const business = await db.business.create({
    data: { name, handle: cleanHandle, ownerId: session.id, plan: "FREE" },
  });

  // Update session to point to the new business
  const token = createSessionToken({ type: "app_user", userId: session.id, businessId: business.id, exp: Date.now() + 7 * 86400000 });
  const res = NextResponse.json({
    business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan },
    user: { ...session, business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan } },
  }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
  return res;
}

// GET /api/business — list the app user's businesses
export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.type !== "app_user") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businesses = await db.business.findMany({
    where: { ownerId: session.id, active: true },
    select: { id: true, name: true, handle: true, plan: true, createdAt: true,
      _count: { select: { employees: true, products: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ businesses });
}
