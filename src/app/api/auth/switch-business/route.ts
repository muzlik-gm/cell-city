import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/auth/switch-business — App User switches active business
export async function POST(req: NextRequest) {
  const { businessId } = await req.json();
  const session = await getCurrentSession();
  if (!session || session.type !== "app_user") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify this business belongs to the user
  const business = await db.business.findFirst({
    where: { id: businessId, ownerId: session.id, active: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const token = createSessionToken({ type: "app_user", userId: session.id, businessId: business.id, exp: Date.now() + 7 * 86400000 });
  const res = NextResponse.json({
    user: {
      ...session,
      business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan },
    },
  });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
  return res;
}
