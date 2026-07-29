import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeString, sanitizeHandle } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// POST /api/business — App User creates a new business workspace
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = sanitizeString(body.name);
    const handle = sanitizeHandle(body.handle);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Business name is required (min 2 characters)" }, { status: 400 });
    }
    if (!handle || handle.length < 3) {
      return NextResponse.json({ error: "Handle must be at least 3 characters (letters, numbers, hyphens)" }, { status: 400 });
    }

    const session = await getCurrentSession();
    if (!session || session.type !== "app_user") {
      logger.warn("Business creation attempted without auth", { handle });
      return NextResponse.json({ error: "Not authenticated. Please sign in again." }, { status: 401 });
    }

    // Check handle uniqueness for this owner
    const existing = await db.business.findFirst({
      where: { ownerId: session.id, handle },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have a business with this handle" }, { status: 409 });
    }

    const business = await db.business.create({
      data: { name, handle, ownerId: session.id, plan: "FREE" },
    });

    // Update session to point to the new business
    const token = createSessionToken({ type: "app_user", userId: session.id, businessId: business.id, exp: Date.now() + 7 * 86400000 });

    logger.info("Business created", { businessId: business.id, handle, ownerId: session.id });

    const res = NextResponse.json({
      business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan },
      user: { ...session, business: { id: business.id, name: business.name, handle: business.handle, plan: business.plan } },
    }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    const error = e as Error;
    logger.error("Business creation failed", { message: error.message });
    return NextResponse.json({ error: "Failed to create business. Please try again." }, { status: 500 });
  }
}

// GET /api/business — list the app user's businesses
export async function GET() {
  try {
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
  } catch (e) {
    logger.error("Failed to list businesses", { message: (e as Error).message });
    return NextResponse.json({ error: "Failed to load businesses" }, { status: 500 });
  }
}
