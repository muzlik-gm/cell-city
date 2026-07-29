import { NextRequest, NextResponse } from "next/server";
import { registerAppUser, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { authRateLimit } from "@/lib/rate-limit";
import { sanitizeString, sanitizeUsername, isValidEmail, isValidPassword } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

// POST /api/auth/register — create a personal App User account
export async function POST(req: NextRequest) {
  // Rate limit: 20 registrations per 15 min per IP
  const limited = authRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const name = sanitizeString(body.name);
    const username = sanitizeUsername(body.username);
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";
    const phone = body.phone ? sanitizeString(body.phone) : undefined;

    // Validation
    if (!name || name.length < 2) return NextResponse.json({ error: "Name is required (min 2 characters)" }, { status: 400 });
    if (!username || username.length < 3) return NextResponse.json({ error: "Username is required (min 3 characters, letters/numbers only)" }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    if (!isValidPassword(password)) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const user = await registerAppUser({ username, email, password, name, phone });
    const token = createSessionToken({ type: "app_user", userId: user.id, exp: Date.now() + 7 * 86400000 });

    logger.info("User registered", { userId: user.id, username });

    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    const error = e as Error;
    logger.error("Registration failed", { message: error.message });
    const isKnown = error.message.includes("already") || error.message.includes("required");
    return NextResponse.json({ error: isKnown ? error.message : "Registration failed" }, { status: isKnown ? 400 : 500 });
  }
}
