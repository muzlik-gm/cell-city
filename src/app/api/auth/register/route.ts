import { NextRequest, NextResponse } from "next/server";
import { createUserWithCompany, setSessionCookie, SESSION_COOKIE } from "@/lib/auth";

// POST /api/auth/register — create a new company + owner account
export async function POST(req: NextRequest) {
  const { companyName, ownerName, ownerEmail, ownerPassword, ownerPhone } = await req.json();

  if (!companyName || !ownerName || !ownerEmail || !ownerPassword) {
    return NextResponse.json({ error: "Company name, owner name, email, and password are required" }, { status: 400 });
  }
  if (ownerPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  try {
    const user = await createUserWithCompany({ companyName, ownerName, ownerEmail, ownerPassword, ownerPhone });
    const token = setSessionCookie(user);
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 86400,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
