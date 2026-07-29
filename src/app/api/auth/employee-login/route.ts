import { NextRequest, NextResponse } from "next/server";
import { loginEmployee, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/employee-login — Employee sub-account login (business handle + username + password)
export async function POST(req: NextRequest) {
  const { businessHandle, username, password } = await req.json();
  if (!businessHandle || !username || !password) {
    return NextResponse.json({ error: "Business handle, username, and password are required" }, { status: 400 });
  }

  try {
    const user = await loginEmployee(businessHandle, username, password);
    const token = createSessionToken({ type: "employee", userId: user.id, businessId: user.business?.id, rank: user.rank, exp: Date.now() + 7 * 86400000 });
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
