import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSessionCookie, SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/login — authenticate and set session cookie
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const user = await loginUser(email, password);
    const token = setSessionCookie(user);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 86400,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
