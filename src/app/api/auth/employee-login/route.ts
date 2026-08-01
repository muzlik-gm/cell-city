import { NextRequest, NextResponse } from "next/server";
import { loginEmployee, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { authRateLimit } from "@/lib/rate-limit";
import { sanitizeHandle, sanitizeUsername, sanitizeString } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// POST /api/auth/employee-login — Employee sub-account login
export async function POST(req: NextRequest) {
  const limited = authRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const businessHandle = sanitizeHandle(body.businessHandle);
    const email = sanitizeString(body.email).toLowerCase().trim();
    const password = body.password ?? "";

    if (!businessHandle || !email || !password) {
      return NextResponse.json({ error: "Business handle, email, and password are required" }, { status: 400 });
    }

    const user = await loginEmployee(businessHandle, email, password);
    const token = createSessionToken({ type: "employee", userId: user.id, businessId: user.business?.id, rank: user.rank, exp: Date.now() + 7 * 86400000 });

    logger.info("Employee logged in", { userId: user.id, email: user.email, business: user.business?.handle });

    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    const error = e as Error;
    logger.warn("Employee login failed", { message: error.message });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
