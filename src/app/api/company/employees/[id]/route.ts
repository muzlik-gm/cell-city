import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isOwnerOrFounder, RANK_LABELS } from "@/lib/auth";

interface Params { params: Promise<{ id: string }> }

// PATCH /api/company/employees/[id] — update rank or active status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.activeCompany) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwnerOrFounder(user.activeCompany.rank)) {
    return NextResponse.json({ error: "Only owners and founders can manage employees" }, { status: 403 });
  }

  const { rank, active } = await req.json();

  const membership = await db.companyMembership.findUnique({ where: { id } });
  if (!membership || membership.companyId !== user.activeCompany.id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Don't allow demoting the company owner
  if (membership.rank === "OWNER" && rank && rank !== "OWNER") {
    return NextResponse.json({ error: "Cannot change the company owner's rank" }, { status: 400 });
  }

  const updated = await db.companyMembership.update({
    where: { id },
    data: {
      ...(rank && RANK_LABELS[rank] ? { rank } : {}),
      ...(typeof active === "boolean" ? { active } : {}),
    },
  });

  return NextResponse.json({ id: updated.id, rank: updated.rank, active: updated.active });
}

// DELETE /api/company/employees/[id] — remove employee from company
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.activeCompany) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwnerOrFounder(user.activeCompany.rank)) {
    return NextResponse.json({ error: "Only owners and founders can remove employees" }, { status: 403 });
  }

  const membership = await db.companyMembership.findUnique({ where: { id } });
  if (!membership || membership.companyId !== user.activeCompany.id) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (membership.rank === "OWNER") {
    return NextResponse.json({ error: "Cannot remove the company owner" }, { status: 400 });
  }

  await db.companyMembership.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
