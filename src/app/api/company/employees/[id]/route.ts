import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession, canManageEmployees, RANK_LABELS } from "@/lib/auth";

interface Params { params: Promise<{ id: string }> }

// PATCH /api/company/employees/[id] — update rank or active status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.business) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const isAppUser = session.type === "app_user";
  if (!isAppUser && !canManageEmployees(session.rank ?? "")) {
    return NextResponse.json({ error: "Only owners and managers can manage employees" }, { status: 403 });
  }

  const { rank, active } = await req.json();
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee || employee.businessId !== session.business.id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const updated = await db.employee.update({
    where: { id },
    data: {
      ...(rank && RANK_LABELS[rank] ? { rank } : {}),
      ...(typeof active === "boolean" ? { active } : {}),
    },
  });

  return NextResponse.json({ id: updated.id, rank: updated.rank, active: updated.active });
}

// DELETE /api/company/employees/[id] — remove employee
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.business) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const isAppUser = session.type === "app_user";
  if (!isAppUser && !canManageEmployees(session.rank ?? "")) {
    return NextResponse.json({ error: "Only owners and managers can remove employees" }, { status: 403 });
  }

  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee || employee.businessId !== session.business.id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  await db.employee.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
