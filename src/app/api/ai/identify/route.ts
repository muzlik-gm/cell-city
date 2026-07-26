import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification endpoint.
//   POST /api/ai/identify
//   FormData:
//     file  — image file (jpeg/png/webp/gif)
//     mode  — "phone" | "lcd"   (default "phone")
//
// Returns:
//   {
//     imageUrl, mode,
//     vlmResult: { detectedModel, brand, model, confidence, features, possibleModels, notes }
//                 | { detectedType, connectorType, flexDescription, frameType, size, confidence, possibleBrands, possibleModels, notes },
//     matchedModels:    PhoneModel[]           (catalog rows matched by brand/model keywords)
//     compatibleModels: { id, name, brand, partType }[]   (compatibility peers of matched models)
//     availableProducts: Product[]             (in-stock products for matched+compatible models)
//   }
//
// Resilient: if VLM JSON parsing fails, fall back to raw text + still return DB matches
// based on any brand/model keywords found in the raw response.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

// Known brand list — used for keyword extraction fallback.
const BRAND_KEYWORDS = [
  "Samsung", "Apple", "iPhone", "Huawei", "Xiaomi", "Redmi", "Oppo", "Vivo",
  "Realme", "Tecno", "Infinix", "Nokia", "Motorola", "OnePlus", "Google",
  "Pixel", "Honor", "Itel", "QMobile", "Haier", "Sony", "LG", "Asus", "Lenovo",
];

const PHONE_PROMPT = `You are an expert mobile phone identification specialist working in a spare-parts warehouse. Analyze this image (usually the back of a phone) and identify the model.

Carefully observe:
- Camera module layout (number of lenses, arrangement: vertical, horizontal, square, circular, ring)
- Flash & sensor placement
- Brand logo (Samsung, Apple, Huawei, Xiaomi, Oppo, Vivo, Realme, Tecno, Infinix, Nokia, etc.)
- Button placement (power, volume, dedicated keys)
- Phone shape (rounded corners, flat edges, notch/punch-hole style)
- Color and material (glass, plastic, metal)
- Any visible text, model numbers, or regulatory markings

Respond with ONLY a strict JSON object — no markdown fences, no commentary — using this exact schema:
{
  "detectedModel": "Best guess brand + model (e.g. 'Samsung Galaxy A12')",
  "brand": "Brand name only (e.g. 'Samsung')",
  "model": "Model name only (e.g. 'Galaxy A12')",
  "confidence": <integer 0-100>,
  "features": {
    "cameraLayout": "Description of camera module",
    "buttonPlacement": "Description of buttons",
    "color": "Description of color",
    "material": "Description of material",
    "notch": "Description of notch/punch-hole if visible"
  },
  "possibleModels": [
    {"model": "Alternative model name", "confidence": <integer 0-100>}
  ],
  "notes": "Brief diagnostic notes, max 2 sentences"
}`;

const LCD_PROMPT = `You are an expert mobile phone LCD/flex/connector identification specialist working in a spare-parts warehouse. Analyze this image of an LCD assembly, flex cable, or connector.

Carefully observe:
- Connector type (push/pull, hook, slide, contact pads, FPC, board-to-board)
- Number of pins and pin layout (single row, dual row)
- Flex cable shape, color, markings, IC chips
- LCD size and aspect ratio
- Frame type (with frame / without frame / bare LCD / flex only)
- Touch digitizer integration (incell / oncell / OGS)
- Any visible markings, barcodes, or model codes

Respond with ONLY a strict JSON object — no markdown fences, no commentary — using this exact schema:
{
  "detectedType": "Best guess description (e.g. 'Samsung Galaxy A12 LCD with frame')",
  "connectorType": "Connector description (e.g. 'Push connector, 30-pin')",
  "flexDescription": "Flex cable description",
  "frameType": "With frame | Without frame | Flex only | Bare LCD",
  "size": "Approximate size if visible (e.g. '6.5 inch')",
  "confidence": <integer 0-100>,
  "possibleBrands": ["Samsung", "Xiaomi"],
  "possibleModels": ["Galaxy A12", "Redmi 9"],
  "notes": "Brief diagnostic notes, max 2 sentences"
}`;

// Try every plausible JSON-extraction strategy before giving up.
function extractJson(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Direct parse.
  try {
    return JSON.parse(trimmed);
  } catch {
    /* keep trying */
  }

  // 2. Strip ```json fences.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* keep trying */
    }
  }

  // 3. Find first { ... } block.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      /* keep trying */
    }
  }

  return null;
}

// Pull brand + model keywords out of a free-text VLM response.
function extractKeywords(text: string): { brands: string[]; models: string[] } {
  const brands = new Set<string>();
  const models = new Set<string>();
  if (!text) return { brands: [], models: [] };

  for (const b of BRAND_KEYWORDS) {
    const re = new RegExp(`\\b${b}\\b`, "i");
    if (re.test(text)) brands.add(b);
  }

  // "Galaxy A12", "Redmi 9", "iPhone 11", "A12", "M12" etc.
  const modelPatterns = [
    /(?:Galaxy\s+)?([A-Z]\d{1,3}(?:\s*[A-Z]?)?)\b/g,    // A12, M11, S22
    /\b(Redmi\s+\d{1,3}(?:\s*[A-Z]?)?)\b/g,              // Redmi 9
    /\b(iPhone\s+\d{1,2}(?:\s+(?:Pro|Max|Mini|Plus))?)\b/gi,
    /\b(Note\s+\d{1,2}(?:\s+Pro)?)\b/gi,
  ];
  for (const re of modelPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      models.add(m[1].trim());
    }
  }

  return { brands: Array.from(brands), models: Array.from(models) };
}

interface MatchedModel {
  id: string;
  name: string;
  slug: string;
  brand?: { id: string; name: string } | null;
  releaseYear?: number | null;
  imageUrl?: string | null;
  notes?: string | null;
}

interface CompatibleModel {
  id: string;
  name: string;
  brand?: string | null;
  partType: string;
  linkId: string;
}

interface AvailableProduct {
  id: string;
  sku: string;
  name: string;
  quality: string;
  condition: string;
  stock: number;
  minStock: number;
  sellingPrice: number;
  purchasePrice: number;
  color?: string | null;
  lcdCode?: string | null;
  connectorType?: string | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  partType?: { name: string; category?: string } | null;
  warehouse?: { name: string } | null;
  shelf?: { code: string } | null;
  images?: { url: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const mode = (formData.get("mode") as string) === "lcd" ? "lcd" : "phone";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 413 });
    }

    // ── Save image to /public/uploads ──────────────────────────────────────
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    const imageUrl = `/uploads/${fileName}`;

    // ── Build VLM request (base64 inline — best per SKILL guidance) ────────
    const mime = file.type || "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;
    const prompt = mode === "phone" ? PHONE_PROMPT : LCD_PROMPT;

    let vlmRaw: string | null = null;
    let vlmResult: Record<string, unknown> | null = null;
    let vlmError: string | null = null;

    try {
      const zai = await ZAI.create();
      const response = await zai.chat.completions.createVision({
        model: "glm-4.6v",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      });
      vlmRaw = response.choices?.[0]?.message?.content ?? null;
      if (vlmRaw) {
        const parsed = extractJson(vlmRaw);
        if (parsed && typeof parsed === "object") {
          vlmResult = parsed as Record<string, unknown>;
        } else {
          // Fallback: wrap raw text.
          vlmResult = {
            detectedModel: mode === "phone" ? "Unable to parse model" : "Unable to parse type",
            confidence: 0,
            notes: vlmRaw.slice(0, 500),
            _raw: vlmRaw,
          };
        }
      } else {
        vlmError = "VLM returned an empty response";
      }
    } catch (e) {
      vlmError = (e as Error).message || "VLM call failed";
    }

    // ── Cross-reference with the database ─────────────────────────────────
    // Collect brand/model keywords from structured VLM result + raw text.
    const combinedText = [
      vlmRaw ?? "",
      vlmResult?.detectedModel as string | undefined,
      vlmResult?.brand as string | undefined,
      vlmResult?.model as string | undefined,
      vlmResult?.detectedType as string | undefined,
      Array.isArray(vlmResult?.possibleModels)
        ? (vlmResult!.possibleModels as Array<Record<string, unknown>>)
            .map((m) => m?.model as string | undefined)
            .filter(Boolean)
            .join(" ")
        : "",
      Array.isArray(vlmResult?.possibleBrands)
        ? (vlmResult!.possibleBrands as string[]).join(" ")
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const { brands: kBrands, models: kModels } = extractKeywords(combinedText);

    // Also include explicitly structured brand + model fields.
    if (vlmResult?.brand && typeof vlmResult.brand === "string" && !kBrands.includes(vlmResult.brand)) {
      kBrands.push(vlmResult.brand);
    }
    if (vlmResult?.model && typeof vlmResult.model === "string" && !kModels.includes(vlmResult.model)) {
      kModels.push(vlmResult.model);
    }

    // Query DB for matching PhoneModel rows by name OR brand.
    const matchedModels: MatchedModel[] = [];
    if (kBrands.length || kModels.length) {
      const orClauses: Record<string, unknown>[] = [];
      for (const m of kModels) {
        orClauses.push({ name: { contains: m } });
      }
      for (const b of kBrands) {
        orClauses.push({ brand: { name: { contains: b } } });
      }
      const rows = await db.phoneModel.findMany({
        where: { active: true, OR: orClauses },
        include: { brand: true },
        take: 12,
        orderBy: { name: "asc" },
      });
      for (const r of rows) {
        matchedModels.push({
          id: r.id,
          name: r.name,
          slug: r.slug,
          brand: r.brand ? { id: r.brand.id, name: r.brand.name } : null,
          releaseYear: r.releaseYear,
          imageUrl: r.imageUrl,
          notes: r.notes,
        });
      }
    }

    // Compatibility peers of matched models.
    const matchedModelIds = matchedModels.map((m) => m.id);
    const compatibleModels: CompatibleModel[] = [];
    if (matchedModelIds.length) {
      const [asModel, asPeer] = await Promise.all([
        db.modelCompatibility.findMany({
          where: { modelId: { in: matchedModelIds } },
          include: { peer: { include: { brand: true } } },
        }),
        db.modelCompatibility.findMany({
          where: { peerId: { in: matchedModelIds } },
          include: { model: { include: { brand: true } } },
        }),
      ]);
      const peerMap = new Map<string, CompatibleModel>();
      for (const c of asModel) {
        peerMap.set(c.peer.id + c.partType, {
          id: c.peer.id,
          name: c.peer.name,
          brand: c.peer.brand?.name ?? null,
          partType: c.partType,
          linkId: c.id,
        });
      }
      for (const c of asPeer) {
        peerMap.set(c.model.id + c.partType, {
          id: c.model.id,
          name: c.model.name,
          brand: c.model.brand?.name ?? null,
          partType: c.partType,
          linkId: c.id,
        });
      }
      compatibleModels.push(...Array.from(peerMap.values()));
    }

    // In-stock products for matched + compatible models.
    const allModelIds = Array.from(
      new Set([...matchedModelIds, ...compatibleModels.map((m) => m.id)]),
    );
    let availableProducts: AvailableProduct[] = [];
    if (allModelIds.length) {
      const prods = await db.product.findMany({
        where: { modelId: { in: allModelIds }, active: true },
        include: {
          brand: true, model: true, partType: true, warehouse: true, shelf: true,
          images: { orderBy: { order: "asc" }, take: 1 },
        },
        orderBy: [{ stock: "desc" }, { name: "asc" }],
        take: 50,
      });
      availableProducts = prods.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        quality: p.quality,
        condition: p.condition,
        stock: p.stock,
        minStock: p.minStock,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        color: p.color,
        lcdCode: p.lcdCode,
        connectorType: p.connectorType,
        brand: p.brand ? { name: p.brand.name } : null,
        model: p.model ? { name: p.model.name } : null,
        partType: p.partType ? { name: p.partType.name, category: p.partType.category } : null,
        warehouse: p.warehouse ? { name: p.warehouse.name } : null,
        shelf: p.shelf ? { code: p.shelf.code } : null,
        images: p.images.map((i) => ({ url: i.url })),
      }));
    }

    return NextResponse.json({
      imageUrl,
      mode,
      vlmResult: vlmResult ?? { detectedModel: "No result", confidence: 0, notes: vlmError ?? "No VLM response" },
      vlmRaw: vlmRaw ?? null,
      vlmError,
      matchedModels,
      compatibleModels,
      availableProducts,
      keywords: { brands: kBrands, models: kModels },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "AI identification failed" },
      { status: 500 },
    );
  }
}
