import { NextRequest, NextResponse } from "next/server";
import { loginAppUser, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/login — App User login (email or username + password)
export async function POST(req: NextRequest) {
  const { identifier, password } = await req.json();
  if (!identifier || !password) {
    return NextResponse.json({ error: "Username/email and password are required" }, { status: 400 });
  }

  try {
    const user = await loginAppUser(identifier, password);
    const token = createSessionToken({ type: "app_user", userId: user.id, businessId: user.business?.id, exp: Date.now() + 7 * 86400000 });
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
