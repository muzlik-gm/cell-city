import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

// GET /api/auth/me — return the currently authenticated user
export async function GET() {
  const user = await getCurrentSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}

// POST /api/auth/logout — clear session
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("cellcity-session", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}
