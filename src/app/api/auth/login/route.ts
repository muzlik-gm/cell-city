import { NextRequest, NextResponse } from "next/server";
import { loginAppUser, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { authRateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// POST /api/auth/login — App User login
export async function POST(req: NextRequest) {
  const limited = authRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const identifier = sanitizeString(body.identifier).toLowerCase();
    const password = body.password ?? "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/email and password are required" }, { status: 400 });
    }

    const user = await loginAppUser(identifier, password);
    const token = createSessionToken({ type: "app_user", userId: user.id, businessId: user.business?.id, exp: Date.now() + 7 * 86400000 });

    logger.info("User logged in", { userId: user.id, username: user.username });

    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    const error = e as Error;
    // Don't reveal whether the email exists — always say "invalid credentials"
    const isKnown = error.message.includes("Invalid") || error.message.includes("deactivated");
    logger.warn("Login failed", { message: error.message });
    return NextResponse.json({ error: isKnown ? error.message : "Login failed" }, { status: 401 });
  }
}
