import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/settings — return all settings as { key: value } object.
export async function GET() {
  const settings = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json(map);
}

// PUT /api/settings — body is { key: value, ... } map. Upsert each entry.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a key-value object" }, { status: 400 });
  }

  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No settings provided" }, { status: 400 });
  }

  // Validate: values must be stringifiable. Coerce numbers/booleans to strings.
  const sanitized: { key: string; value: string }[] = [];
  for (const [key, value] of entries) {
    if (!key || typeof key !== "string") continue;
    const v = value == null ? "" : typeof value === "string" ? value : String(value);
    sanitized.push({ key, value: v });
  }

  await db.$transaction(
    sanitized.map((s) =>
      db.setting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value },
      })
    )
  );

  // Return updated full map
  const all = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of all) map[s.key] = s.value;
  return NextResponse.json(map);
}
