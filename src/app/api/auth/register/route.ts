import { NextRequest, NextResponse } from "next/server";
import { registerAppUser, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/register — create a personal App User account (no business yet)
export async function POST(req: NextRequest) {
  const { username, email, password, name, phone } = await req.json();

  if (!username || !email || !password || !name) {
    return NextResponse.json({ error: "Username, email, password, and name are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }

  try {
    const user = await registerAppUser({ username, email, password, name, phone });
    const token = createSessionToken({ type: "app_user", userId: user.id, exp: Date.now() + 7 * 86400000 });
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
