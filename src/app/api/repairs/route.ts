import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";
import { Prisma } from "@prisma/client";

// GET /api/repairs — list with filters (q, status, technicianId) + pagination.
// Includes customer, model+brand, technician, parts.product.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status");
  const technicianId = searchParams.get("technicianId");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const where: Prisma.RepairJobWhereInput = {};
  if (status) where.status = status;
  if (technicianId) where.technicianId = technicianId;
  if (customerId) where.customerId = customerId;
  if (q) {
    where.OR = [
      { ticketNo: { contains: q } },
      { imei: { contains: q } },
      { problem: { contains: q } },
      { diagnosis: { contains: q } },
      { notes: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { phone: { contains: q } } },
      { model: { name: { contains: q } } },
      { model: { brand: { name: { contains: q } } } },
      { technician: { name: { contains: q } } },
    ];
  }

  const [total, repairs] = await Promise.all([
    db.repairJob.count({ where }),
    db.repairJob.findMany({
      where,
      include: {
        customer: true,
        model: { include: { brand: true } },
        technician: true,
        parts: { include: { product: { include: { brand: true, model: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: repairs, total, page, pageSize });
}

// Generate ticket number RPR-YYYYMM-NNNN where NNNN is sequence for the month.
async function generateTicketNo(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `RPR-${y}${m}-`;
  const count = await db.repairJob.count({ where: { ticketNo: { startsWith: prefix } } });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

// POST /api/repairs — create repair ticket (status defaults to RECEIVED).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    customerId, modelId, technicianId, imei, problem, diagnosis,
    laborCost, partsCost, notes, imageUrl,
  } = body as {
    customerId?: string;
    modelId?: string;
    technicianId?: string;
    imei?: string;
    problem?: string;
    diagnosis?: string;
    laborCost?: number;
    partsCost?: number;
    notes?: string;
    imageUrl?: string;
  };

  if (!problem || typeof problem !== "string" || !problem.trim()) {
    return NextResponse.json({ error: "Problem description is required" }, { status: 400 });
  }

  const ticketNo = await generateTicketNo();
  const labor = Math.max(0, Number(laborCost) || 0);
  const parts = Math.max(0, Number(partsCost) || 0);
  const total = labor + parts;

  const repair = await db.repairJob.create({
    data: {
      ticketNo,
      customerId: customerId || null,
      modelId: modelId || null,
      technicianId: technicianId || null,
      imei: imei?.trim() || null,
      problem: problem.trim(),
      diagnosis: diagnosis?.trim() || null,
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      laborCost: labor,
      partsCost: parts,
      total,
      paid: 0,
      notes: notes?.trim() || null,
      imageUrl: imageUrl || null,
      receivedAt: new Date(),
    },
    include: {
      customer: true,
      model: { include: { brand: true } },
      technician: true,
      parts: { include: { product: { include: { brand: true, model: true } } } },
    },
  });

  return NextResponse.json(repair, { status: 201 });
}
