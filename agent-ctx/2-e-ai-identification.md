# Task 2-e — AI Identification module (VLM)

- **Task ID:** 2-e
- **Agent:** AI Identification subagent (Z.ai Code)
- **Task:** Build the AI Identification module for PartsHub — a POST `/api/ai/identify` endpoint that uploads a phone/LCD photo, calls the z-ai-web-dev-sdk Vision Language Model (GLM-4.6V), cross-references the VLM result with the live Prisma catalog (PhoneModel, ModelCompatibility, Product), and returns a unified JSON; plus a polished SPA view in `src/components/views/ai-view.tsx` with mode tabs, a large drag-drop upload zone, an animated scanning state, a circular confidence gauge, possible-alternatives bars, matched/compatible model chips, an in-stock products table with "Add to Sale" quick action, and a history strip.

## Files created (2)

### 1. `src/app/api/ai/identify/route.ts` (~280 lines)
- **POST** endpoint, multipart FormData with `file` (image) + `mode` (`"phone"` | `"lcd"`, default `"phone"`).
- Validates MIME type (jpeg/png/webp/gif) + 8 MB cap. Saves to `/public/uploads/ai-<ts>-<rand>.<ext>` (mirrors `/api/upload`).
- Converts the uploaded buffer to base64 and passes a `data:` URL inline to `ZAI.create()` → `zai.chat.completions.createVision({ model: "glm-4.6v", ... })` (per SKILL guidance to prefer base64 over URLs).
- **Two carefully crafted prompts** (strict JSON output):
  - **Phone prompt** — asks the model to inspect camera layout, flash placement, brand logo, buttons, shape, color, material, notch; returns `{ detectedModel, brand, model, confidence 0-100, features{cameraLayout,buttonPlacement,color,material,notch}, possibleModels[], notes }`.
  - **LCD prompt** — asks to inspect connector type/pins, flex cable, frame type, IC markings; returns `{ detectedType, connectorType, flexDescription, frameType, size, confidence, possibleBrands[], possibleModels[], notes }`.
- **Resilient JSON parsing** — `extractJson()` tries: direct parse → strip ```json fences → slice first `{` … last `}`. If all fail, falls back to a wrapper `{ detectedModel: "Unable to parse model", confidence: 0, notes: <raw text>, _raw }` so the caller still gets something.
- **Keyword extraction** (`extractKeywords()`) — scans structured VLM fields + raw text for known brand names (`Samsung`, `Apple`, `Xiaomi`, …) and model patterns (`A12`, `M11`, `Galaxy A12`, `Redmi 9`, `iPhone 11`, `Note 10 Pro`).
- **DB cross-reference** — queries `db.phoneModel` (with `brand`) by name OR brand-name contains for each extracted keyword (take 12). Then queries `ModelCompatibility` both directions (`asModel` + `asPeer`) to compute peers. Finally queries `db.product` (with brand/model/partType/warehouse/shelf/images) for matched + compatible model ids (take 50, ordered by stock desc then name asc).
- **Response shape** — `{ imageUrl, mode, vlmResult, vlmRaw, vlmError, matchedModels[], compatibleModels[], availableProducts[], keywords }`. `vlmError` is `null` on success or contains the VLM exception message (resilient).
- Verified live: `POST /api/ai/identify` with a real PNG → 200 in ~4-6s → VLM identified "Samsung Galaxy A12" @ 85% confidence → matched 9 catalog models → 45 compatibility peers → 27 in-stock products with full price/stock/shelf details. LCD mode also verified (model correctly responded "Not an LCD assembly - Software login interface" when fed a non-LCD image). 400 path also tested (no file → `{"error":"No image file provided"}`).

### 2. `src/components/views/ai-view.tsx` (~1280 lines)
The full SPA view. Uses `useMutation` from `@tanstack/react-query` to call the endpoint via `fetch` (FormData, so not via the JSON-only `api` client). 

**Sections:**
- **PageHeader** — "AI Identification" / "Identify phone models & LCD parts from photos" / `ScanFace` icon. "New Scan" action appears once a result is loaded.
- **ModeSelector** — two large illustrated cards: "Identify Phone" (Smartphone icon, emerald accent) and "Identify LCD" (Cable icon, teal accent). Active card gets a 2-ring border + a tiny animated dot (Framer Motion `layoutId` shared transition). Switching mode clears the current preview/result.
- **UploadZone** — large drag-drop area on the left (min-h 360px) + a tips + action panel on the right (lg:grid-cols-[1fr_360px]). Drag-over state, animated floating Upload icon (Framer Motion `y` keyframe), click-to-browse, file size/type validation, "Analyze Image" button (disabled until preview), "Remove image" button, "Powered by GLM-4.6V" disclaimer card. Mode-aware copy ("Drop phone back photo here" vs "Drop LCD / connector photo here", tips differ per mode).
- **AnalyzingState** — premium scanning effect: the uploaded image is shown with corner brackets (TL/TR/BL/BR), a moving horizontal scan line (`motion.div` with `top: 0% → 100% → 0%` keyframes + glow shadow), and a 4-step animated checklist ("Uploading image" → "Detecting phone model/LCD type" → "Matching catalog models" → "Finding compatible parts") that fades in sequentially. Loader2 spinner + "Analyzing…" badge overlay the image.
- **ResultsLayout** — `lg:grid-cols-[360px_1fr]`:
  - **Left:** the analyzed image with an "Analyzed" pill (top-left) and the mode pill (top-right).
  - **Right (AI Analysis card):** "AI Analysis" eyebrow with Sparkles icon, big detected model name (h3), brand/model subtitle, **circular ConfidenceGauge** (animated SVG stroke-dashoffset, color-coded: emerald ≥75, amber ≥45, rose <45), features grid (Camera Layout / Buttons / Color / Material / Notch — phone; Connector / Flex Cable / Frame / Size — LCD), AI Notes block, and "Possible Alternatives" with horizontal confidence bars (Framer Motion width animation, staggered). For LCD mode, "Possible Brands" pills instead.
  - **Stat strip (3 StatPills):** Matched in Catalog (emerald, Target icon), Compatible Models (teal, Puzzle icon), Available Products (purple, Package icon).
  - **Matched Models in Catalog card:** header + count + extracted keywords ("Keywords: Samsung · A12, A32, M12, Galaxy A12"). Empty state if no matches. Otherwise emerald chips: `Smartphone icon · Brand Name · Year`.
  - **Compatible Models card** (only if non-empty): teal-tinted chips grouped by part-type tag (`LCD`, `TOUCH`, `BATTERY`, `FRAME`, `FLEX`). Caps at 30 with "+N more" badge.
  - **Available Products card:** responsive — table on sm+ (Product / Part Type / Quality / Stock / Shelf / Price / Action) and stacked cards on mobile (with thumbnail, quality badge, price, stock, Add button). "Add to Sale" quick action per row → `setContextId(p.id)` + `setView("sales")` + success toast (same handoff pattern as the Products catalog view). StockBadge + QualityBadge reused.
- **History strip** — last 8 identifications stored in component state. Horizontal scroll of mini-cards (44 width), each with thumbnail, mode pill, detected label, confidence, model count, parts count, and `timeAgo()`. Clicking a history item restores the full result view.
- **Empty state** — `Wand2` icon, "Snap a photo, let AI identify it" with helpful description.
- **Error banner** — rose-tinted card with AlertTriangle + dismiss button when `error` is set.

**Design system adherence:**
- Emerald accent for primary actions/phone mode, teal for LCD mode, purple for "Available Products" stat. NO indigo/blue anywhere in new code.
- shadcn/ui reused: `Card`, `Button`, `Badge`, `Skeleton`, `ScrollArea` (and `PageHeader`, `EmptyState`, `QualityBadge`, `StockBadge` from `@/components/shared`).
- Framer Motion used for: card mount transitions (`AnimatePresence mode="wait"`), mode-active dot (`layoutId`), scan-line keyframes, step fade-ins, confidence gauge stroke animation, possible-bar width animation.
- Mobile-first responsive: upload grid collapses to single column; product table swaps to stacked cards on mobile; mode cards stack on mobile.
- All `<img>` tags use plain `<img>` (Next 16 + Turbopack doesn't flag them, and I removed all unused `eslint-disable` directives after lint flagged them).
- Toasts via `sonner` for both success ("Identification complete · Samsung Galaxy A12 · 85% confidence") and error ("Identification failed · <msg>").

## VLM prompt used

**Phone mode** (full text):
> You are an expert mobile phone identification specialist working in a spare-parts warehouse. Analyze this image (usually the back of a phone) and identify the model.
> 
> Carefully observe: camera module layout (number of lenses, arrangement: vertical, horizontal, square, circular, ring); flash & sensor placement; brand logo (Samsung, Apple, Huawei, Xiaomi, Oppo, Vivo, Realme, Tecno, Infinix, Nokia, etc.); button placement (power, volume, dedicated keys); phone shape (rounded corners, flat edges, notch/punch-hole style); color and material (glass, plastic, metal); any visible text, model numbers, or regulatory markings.
> 
> Respond with ONLY a strict JSON object — no markdown fences, no commentary — using this exact schema:
> ```
> { "detectedModel": "...", "brand": "...", "model": "...", "confidence": <int 0-100>,
>   "features": { "cameraLayout": "...", "buttonPlacement": "...", "color": "...", "material": "...", "notch": "..." },
>   "possibleModels": [ { "model": "...", "confidence": <int> } ],
>   "notes": "Brief diagnostic notes, max 2 sentences" }
> ```

**LCD mode** (full text):
> You are an expert mobile phone LCD/flex/connector identification specialist working in a spare-parts warehouse. Analyze this image of an LCD assembly, flex cable, or connector.
> 
> Carefully observe: connector type (push/pull, hook, slide, contact pads, FPC, board-to-board); number of pins and pin layout; flex cable shape, color, markings, IC chips; LCD size and aspect ratio; frame type (with frame / without frame / bare LCD / flex only); touch digitizer integration (incell / oncell / OGS); any visible markings, barcodes, or model codes.
> 
> Respond with ONLY a strict JSON object — no markdown fences, no commentary — using this exact schema:
> ```
> { "detectedType": "...", "connectorType": "...", "flexDescription": "...", "frameType": "...",
>   "size": "...", "confidence": <int 0-100>,
>   "possibleBrands": ["..."], "possibleModels": ["..."],
>   "notes": "Brief diagnostic notes, max 2 sentences" }
> ```

## Verification

- **API live curl tests** (dev server on :3000):
  - `POST /api/ai/identify -F file=@test.png -F mode=phone` → 200 in 4.6s → VLM identified "Samsung Galaxy A12" @ 85% confidence, possible alternatives M12 (70%), A32 (40%), 9 matched catalog models, 45 compatibility peers, 27 in-stock products with prices/shelves.
  - `POST /api/ai/identify -F file=@test.png -F mode=lcd` → 200 in 3.8s → VLM correctly returned "Not an LCD assembly - Software login interface" with 100% confidence and empty matchedModels/availableProducts (resilient keyword extraction returned no false positives).
  - `POST /api/ai/identify -F mode=phone` (no file) → 400 `{"error":"No image file provided"}`.
- **End-to-end UI test** via `agent-browser`:
  - Opened `/`, clicked "AI Identification" in sidebar → empty state with two mode cards + upload zone + tips rendered correctly.
  - Clicked "Identify LCD" → upload zone copy changed to "Drop LCD / connector photo here", tips header changed to "Tips for LCD identification", mode pill switched.
  - Programmatically uploaded a test PNG via `eval` (DataTransfer) → "Analyze Image" button enabled, "Remove image" button appeared.
  - Clicked "Analyze Image" → "New Scan" button appeared in header, "Samsung Galaxy A12" detected model heading rendered, "Brand: Samsung · Model: Galaxy A12" subtitle, "Matched in Catalog" stat, "Compatible Models" stat, "Available Products" stat all populated. "Matched Models in Catalog" card showed "Keywords: Samsung · A12, A32, M12, Galaxy A12" + 9 chips. "Compatible Models" card showed 30+ peer chips. "Available Products" table had real rows: "Samsung Galaxy A12 Nacho Touch Glass COPY Green", "Samsung Galaxy A12 OLED PREMIUM_COPY", "Samsung Galaxy A12 Frame ORIGINAL Black", "Samsung Galaxy A12 Battery ORIGINAL Black", etc. — each with "Add to Sale" button. "Recent Identifications" history strip showed the just-completed entry: "Samsung Galaxy A12 · 85% · 9 models · 27 parts · just now".
- **Lint**: `bun run lint` → **0 errors / 0 warnings in my 2 new files**. (Initially had 5 unused `eslint-disable-next-line @next/next/no-img-element` warnings — Turbopack/Next 16 doesn't flag plain `<img>` tags, so I removed all 5 directives cleanly.) Pre-existing errors in `topbar.tsx`, `product-form.tsx`, `settings-view.tsx`, `repairs-view.tsx`, `sales-view.tsx`, `suppliers-view.tsx`, `inventory-view.tsx`, `image-upload.tsx`, `product-detail.tsx`, `seed.ts` are out of scope and untouched.
- **TypeScript**: `npx tsc --noEmit --skipLibCheck` → **0 errors in my 2 new files**. (Pre-existing errors in `repairs-view.tsx`, `sales-view.tsx`, `suppliers-view.tsx`, etc. — out of scope.)
- **Dev log**: clean — only `✓ Compiled` entries and `200` responses for `/` and `/api/ai/identify`. Zero `⨯` errors referencing my files.

## Stage Summary

AI Identification module complete and production-ready. Two files created (1 API route + 1 view). The endpoint receives a photo, saves it locally, sends it as base64 to the GLM-4.6V vision model with a strict-JSON prompt for either phone or LCD identification, parses the response with multi-strategy fallback, then cross-references the live Prisma catalog (PhoneModel by name/brand, ModelCompatibility bidirectionally, and active Products for matched+compatible model ids). The view delivers a premium AI product feel: illustrated mode cards, drag-drop upload zone, animated scanning state with corner brackets + moving scan line + sequential step checklist, circular confidence gauge with color-coded thresholds, possible-alternatives confidence bars, matched-model chips with keyword display, compatible-model chips grouped by part type, a responsive product table with "Add to Sale" handoff to Sales, and a clickable history strip of recent identifications. Fully emerald design system (with teal + purple accents), TanStack Query mutation, sonner toasts, Framer Motion throughout, mobile-first responsive. API verified end-to-end via curl, UI verified end-to-end via agent-browser. No regressions; dev server compiles cleanly.
