 
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const db = new PrismaClient();

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log("🌱 Seeding database...");

  // ── Settings ─────────────────────────────────────────────
  const settings: Record<string, string> = {
    business_name: "Cell City",
    business_phone: "+92 300 1234567",
    business_address: "Main Market, Karachi, Pakistan",
    business_email: "info@cellcity.com",
    currency: "PKR",
    currency_symbol: "Rs",
    tax_rate: "0",
    tax_name: "Sales Tax",
    invoice_prefix: "INV",
    po_prefix: "PO",
    ticket_prefix: "RPR",
    low_stock_threshold: "5",
    theme: "light",
    language: "en",
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { key: k },
      update: { value: v },
      create: { key: k, value: v },
    });
  }

  // ── User (demo owner) ────────────────────────────────────
  const existingUser = await db.user.findUnique({ where: { email: "owner@cellcity.com" } });
  if (!existingUser) {
    await db.user.create({
      data: {
        email: "owner@cellcity.com",
        name: "Shop Owner",
        passwordHash: "$2a$10$demo_hash_replace_in_production_xxxxxxxxxxxxx", // demo only
        role: "OWNER",
        phone: "+92 300 1234567",
      },
    });
  }

  // ── Warehouses & Shelves ─────────────────────────────────
  const whMain = await db.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: { name: "Main Warehouse", code: "WH-MAIN", address: "Shop Floor, Karachi" },
  });
  const whBackup = await db.warehouse.upsert({
    where: { code: "WH-BKP" },
    update: {},
    create: { name: "Backup Store", code: "WH-BKP", address: "Storage Unit, Karachi" },
  });

  const shelves = [
    { code: "A1", warehouseId: whMain.id, rack: "A", bin: "1", description: "Samsung LCDs" },
    { code: "A2", warehouseId: whMain.id, rack: "A", bin: "2", description: "iPhone LCDs" },
    { code: "B1", warehouseId: whMain.id, rack: "B", bin: "1", description: "Batteries" },
    { code: "B2", warehouseId: whMain.id, rack: "B", bin: "2", description: "Flex Cables" },
    { code: "C1", warehouseId: whMain.id, rack: "C", bin: "1", description: "Frames & Housing" },
    { code: "C2", warehouseId: whMain.id, rack: "C", bin: "2", description: "Touch Glass" },
    { code: "D1", warehouseId: whBackup.id, rack: "D", bin: "1", description: "Overstock" },
  ];
  const shelfMap: Record<string, string> = {};
  for (const s of shelves) {
    const sh = await db.shelf.upsert({
      where: { warehouseId_code: { warehouseId: s.warehouseId, code: s.code } },
      update: {},
      create: s,
    });
    shelfMap[s.code] = sh.id;
  }

  // ── Brands ───────────────────────────────────────────────
  const brands = ["Samsung", "Apple", "Xiaomi", "Oppo", "Vivo", "Realme", "Huawei", "Infinix", "Tecno", "Nokia"];
  const brandMap: Record<string, string> = {};
  for (const b of brands) {
    const brand = await db.brand.upsert({
      where: { slug: slug(b) },
      update: {},
      create: { name: b, slug: slug(b), country: b === "Apple" ? "USA" : b === "Samsung" ? "Korea" : b === "Nokia" || b === "Huawei" ? "China" : "China" },
    });
    brandMap[b] = brand.id;
  }

  // ── Phone Models (with realistic compatibility groups) ──
  // Each group shares parts. We'll create models and link compatibilities.
  const modelGroups: { name: string; brand: string; year?: number }[][] = [
    // Samsung A series LCD sharing
    [
      { name: "Samsung Galaxy A12", brand: "Samsung", year: 2020 },
      { name: "Samsung Galaxy A12 Nacho", brand: "Samsung", year: 2021 },
      { name: "Samsung Galaxy M12", brand: "Samsung", year: 2021 },
      { name: "Samsung Galaxy F12", brand: "Samsung", year: 2021 },
    ],
    [
      { name: "Samsung Galaxy A50", brand: "Samsung", year: 2019 },
      { name: "Samsung Galaxy A30", brand: "Samsung", year: 2019 },
      { name: "Samsung Galaxy A30s", brand: "Samsung", year: 2019 },
    ],
    [
      { name: "Samsung Galaxy A22", brand: "Samsung", year: 2021 },
      { name: "Samsung Galaxy A32", brand: "Samsung", year: 2021 },
    ],
    // Apple
    [
      { name: "iPhone 11", brand: "Apple", year: 2019 },
      { name: "iPhone 11 Pro", brand: "Apple", year: 2019 },
      { name: "iPhone 11 Pro Max", brand: "Apple", year: 2019 },
    ],
    [
      { name: "iPhone X", brand: "Apple", year: 2017 },
      { name: "iPhone XS", brand: "Apple", year: 2018 },
    ],
    [
      { name: "iPhone 13", brand: "Apple", year: 2021 },
      { name: "iPhone 13 Pro", brand: "Apple", year: 2021 },
    ],
    // Xiaomi
    [
      { name: "Redmi Note 8", brand: "Xiaomi", year: 2019 },
      { name: "Redmi Note 8 Pro", brand: "Xiaomi", year: 2019 },
    ],
    [
      { name: "Redmi 9A", brand: "Xiaomi", year: 2020 },
      { name: "Redmi 9 Activ", brand: "Xiaomi", year: 2020 },
    ],
    // Oppo
    [
      { name: "Oppo A3s", brand: "Oppo", year: 2018 },
      { name: "Oppo A5", brand: "Oppo", year: 2018 },
      { name: "Oppo A5s", brand: "Oppo", year: 2019 },
    ],
    // Vivo
    [
      { name: "Vivo Y11", brand: "Vivo", year: 2019 },
      { name: "Vivo Y12", brand: "Vivo", year: 2019 },
      { name: "Vivo Y15", brand: "Vivo", year: 2019 },
    ],
    // Infinix / Tecno
    [
      { name: "Infinix Hot 10", brand: "Infinix", year: 2020 },
      { name: "Infinix Hot 10 Play", brand: "Infinix", year: 2020 },
    ],
    [
      { name: "Tecno Spark 6", brand: "Tecno", year: 2020 },
      { name: "Tecno Spark 6 Go", brand: "Tecno", year: 2020 },
    ],
    [
      { name: "Realme C11", brand: "Realme", year: 2020 },
      { name: "Realme C12", brand: "Realme", year: 2020 },
      { name: "Realme C15", brand: "Realme", year: 2020 },
    ],
    [
      { name: "Huawei Y7 Prime", brand: "Huawei", year: 2019 },
      { name: "Huawei Y7 Pro", brand: "Huawei", year: 2019 },
    ],
    [
      { name: "Nokia 2.4", brand: "Nokia", year: 2020 },
      { name: "Nokia 3.4", brand: "Nokia", year: 2020 },
    ],
  ];

  const modelMap: Record<string, string> = {};
  for (const group of modelGroups) {
    for (const m of group) {
      const model = await db.phoneModel.upsert({
        where: { slug: slug(m.name) },
        update: {},
        create: { name: m.name, slug: slug(m.name), brandId: brandMap[m.brand], releaseYear: m.year },
      });
      modelMap[m.name] = model.id;
    }
    // link all peers in the group bidirectionally for several part types
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = modelMap[group[i].name];
        const b = modelMap[group[j].name];
        for (const pt of ["LCD", "TOUCH", "BATTERY", "FRAME", "FLEX"]) {
          try {
            await db.modelCompatibility.create({
              data: { modelId: a, peerId: b, partType: pt, note: `Shared ${pt.toLowerCase()}` },
            });
          } catch {
            /* unique constraint, ignore */
          }
        }
      }
    }
  }

  // ── Part Types ───────────────────────────────────────────
  const partTypes = [
    { name: "LCD", category: "Display" },
    { name: "OLED", category: "Display" },
    { name: "AMOLED", category: "Display" },
    { name: "Touch Glass", category: "Display" },
    { name: "Frame", category: "Housing" },
    { name: "Housing", category: "Housing" },
    { name: "Back Glass", category: "Housing" },
    { name: "Battery", category: "Power" },
    { name: "Charging Flex", category: "Flex" },
    { name: "Power Flex", category: "Flex" },
    { name: "Volume Flex", category: "Flex" },
    { name: "Front Camera", category: "Camera" },
    { name: "Camera", category: "Camera" },
    { name: "Speaker", category: "Audio" },
    { name: "Earpiece", category: "Audio" },
    { name: "Motherboard", category: "Board" },
    { name: "IC", category: "Board" },
    { name: "Buttons", category: "Button" },
    { name: "Sim Tray", category: "Misc" },
  ];
  const ptMap: Record<string, string> = {};
  for (const p of partTypes) {
    const pt = await db.partType.upsert({
      where: { slug: slug(p.name) },
      update: {},
      create: { name: p.name, slug: slug(p.name), category: p.category },
    });
    ptMap[p.name] = pt.id;
  }

  // ── Suppliers ────────────────────────────────────────────
  const suppliers = [
    { name: "Guangzhou Display Co.", company: "GZ Display Ltd", phone: "+86 138 0000 1111", whatsapp: "+8613800001111", email: "sales@gzdisplay.cn", address: "Guangzhou, China", rating: 5 },
    { name: "Shenzhen Parts Hub", company: "SZ Parts Hub", phone: "+86 139 2222 3333", whatsapp: "+8613922223333", email: "info@szpartshub.cn", address: "Shenzhen, China", rating: 4 },
    { name: "Karachi Wholesale Market", company: "KWM Traders", phone: "+92 333 1234567", whatsapp: "+923331234567", email: "kwm@local.pk", address: "Light House, Karachi", rating: 4 },
    { name: "Dubai Mobile Hub", company: "DMH FZE", phone: "+971 50 123 4567", whatsapp: "+971501234567", email: "contact@dmh.ae", address: "Deira, Dubai", rating: 5 },
  ];
  const supMap: Record<string, string> = {};
  for (const s of suppliers) {
    const sup = await db.supplier.upsert({
      where: { id: (await db.supplier.findFirst({ where: { name: s.name } }))?.id ?? "nonexist" },
      update: {},
      create: s as any,
    });
    supMap[s.name] = sup.id;
  }

  // ── Customers ────────────────────────────────────────────
  const customers = [
    { name: "Ahmed Mobile Shop", phone: "+92 301 1111111", whatsapp: "+923011111111", address: "Saddar, Karachi", company: "Ahmed Mobiles" },
    { name: "Bilal Repair Center", phone: "+92 302 2222222", whatsapp: "+923022222222", address: "Gulshan, Karachi", company: "Bilal Repairs" },
    { name: "Usman Cell Point", phone: "+92 303 3333333", whatsapp: "+923033333333", address: "Korangi, Karachi", company: "Usman Cell" },
    { name: "Walk-in Customer", phone: "", address: "" },
  ];
  for (const c of customers) {
    const exists = await db.customer.findFirst({ where: { name: c.name } });
    if (!exists) await db.customer.create({ data: c as any });
  }

  // ── Products (inventory) ─────────────────────────────────
  // Generate a realistic catalog from model groups
  const allModels = Object.entries(modelMap);
  const qualities = ["ORIGINAL", "OEM", "COPY", "PREMIUM_COPY"];
  const colors = ["Black", "White", "Blue", "Gold", "Red", "Green"];

  let skuCounter = 1000;
  const productSpecs: { part: string; priceRange: [number, number]; costRatio: number; connector?: string }[] = [
    { part: "LCD", priceRange: [1800, 6500], costRatio: 0.65, connector: "J1" },
    { part: "OLED", priceRange: [8000, 22000], costRatio: 0.7 },
    { part: "Touch Glass", priceRange: [600, 1800], costRatio: 0.6 },
    { part: "Battery", priceRange: [700, 1800], costRatio: 0.7 },
    { part: "Frame", priceRange: [500, 2500], costRatio: 0.6 },
    { part: "Charging Flex", priceRange: [300, 900], costRatio: 0.65 },
    { part: "Front Camera", priceRange: [400, 1500], costRatio: 0.6 },
    { part: "Speaker", priceRange: [250, 700], costRatio: 0.6 },
  ];

  const suppliersArr = Object.values(supMap);
  const shelfCodes = Object.keys(shelfMap);
  let created = 0;
  const target = 120; // seed product count
  let idx = 0;
  while (created < target && idx < allModels.length) {
    const [modelName, modelId] = allModels[idx % allModels.length];
    const model = await db.phoneModel.findUnique({ where: { id: modelId } });
    idx++;
    if (!model) continue;
    // pick 3 part types per model
    const picks = productSpecs.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const spec of picks) {
      if (created >= target) break;
      const pt = ptMap[spec.part];
      if (!pt) continue;
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      const color = Math.random() > 0.4 ? colors[Math.floor(Math.random() * colors.length)] : null;
      const sell = Math.round(spec.priceRange[0] + Math.random() * (spec.priceRange[1] - spec.priceRange[0]));
      const cost = Math.round(sell * spec.costRatio);
      const stock = Math.floor(Math.random() * 40);
      const minStock = 5;
      const shelfCode = spec.part === "Battery" ? "B1" : spec.part.includes("Flex") ? "B2" : spec.part === "Frame" ? "C1" : spec.part === "Touch Glass" ? "C2" : shelfCodes[Math.floor(Math.random() * 5)];
      const brandId = model.brandId;
      skuCounter++;
      const sku = `MSP-${skuCounter}`;
      const brandName = modelName.split(" ")[0];
      const lcdCode = spec.part === "LCD" || spec.part === "OLED" ? `${brandName.substring(0, 2).toUpperCase()}-${1000 + skuCounter}` : null;
      const product = await db.product.create({
        data: {
          sku,
          barcode: `890${skuCounter}${Math.floor(Math.random() * 90 + 10)}`,
          qrCode: sku,
          name: `${modelName} ${spec.part} ${quality}${color ? " " + color : ""}`.trim(),
          brandId,
          modelId,
          partTypeId: pt,
          quality,
          condition: "NEW",
          color,
          supplierId: suppliersArr[Math.floor(Math.random() * suppliersArr.length)],
          purchasePrice: cost,
          sellingPrice: sell,
          stock,
          minStock,
          warehouseId: whMain.id,
          shelfId: shelfMap[shelfCode] ?? shelfMap["A1"],
          connectorType: spec.connector ?? null,
          lcdCode,
          notes: quality === "COPY" ? "Copy quality, verify connector version" : quality === "PREMIUM_COPY" ? "Premium copy, low return rate" : "Original stock",
        },
      });
      // price history
      await db.priceHistory.create({
        data: {
          productId: product.id,
          supplierId: product.supplierId,
          purchasePrice: cost,
          sellingPrice: sell,
          note: "Initial stock",
        },
      });
      created++;
    }
  }
  console.log(`✅ Created ${created} products`);

  // ── Demo Sales (last 14 days) ────────────────────────────
  const customerIds = (await db.customer.findMany()).map((c) => c.id);
  const products = await db.product.findMany({ where: { stock: { gt: 0 } } });
  const userId = (await db.user.findFirst())?.id;
  const now = new Date();
  for (let d = 13; d >= 0; d--) {
    const salesToday = Math.floor(Math.random() * 6) + 1;
    for (let s = 0; s < salesToday; s++) {
      const items: any[] = [];
      let subtotal = 0;
      let profit = 0;
      const itemCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < itemCount; i++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const lineTotal = p.sellingPrice * qty;
        subtotal += lineTotal;
        profit += (p.sellingPrice - p.purchasePrice) * qty;
        items.push({
          productId: p.id,
          name: p.name,
          qty,
          price: p.sellingPrice,
          cost: p.purchasePrice,
          discount: 0,
          total: lineTotal,
        });
      }
      const total = subtotal;
      const createdAt = new Date(now.getTime() - d * 86400000 - Math.random() * 86400000);
      const invNo = `INV-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${String(s + 1).padStart(3, "0")}`;
      try {
        await db.sale.create({
          data: {
            invoiceNo: invNo,
            customerId: customerIds[Math.floor(Math.random() * customerIds.length)] ?? null,
            userId,
            subtotal,
            discount: 0,
            tax: 0,
            total,
            profit,
            paid: total,
            paymentMethod: ["CASH", "CARD", "BANK", "MOBILE"][Math.floor(Math.random() * 4)],
            paymentStatus: "PAID",
            status: "COMPLETED",
            createdAt,
            items: { create: items },
          },
        });
      } catch {
        /* dup invoice */
      }
    }
  }
  console.log("✅ Demo sales created");

  // ── Demo Purchases (last 30 days) ────────────────────────
  const supplierIds = suppliersArr;
  for (let d = 29; d >= 0; d -= 3) {
    const poItems: any[] = [];
    let subtotal = 0;
    const cnt = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < cnt; i++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 20) + 5;
      const lineTotal = p.purchasePrice * qty;
      subtotal += lineTotal;
      poItems.push({ productId: p.id, name: p.name, qty, cost: p.purchasePrice, price: p.purchasePrice, total: lineTotal });
    }
    const createdAt = new Date(now.getTime() - d * 86400000);
    const poNo = `PO-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${String(d).padStart(3, "0")}`;
    try {
      await db.purchase.create({
        data: {
          poNo,
          supplierId: supplierIds[Math.floor(Math.random() * supplierIds.length)],
          userId,
          subtotal,
          total: subtotal,
          paid: subtotal,
          paymentStatus: "PAID",
          status: "RECEIVED",
          createdAt,
          items: { create: poItems },
        },
      });
    } catch {
      /* dup */
    }
  }
  console.log("✅ Demo purchases created");

  // ── Demo Repair Jobs ─────────────────────────────────────
  const repairStatuses = ["RECEIVED", "DIAGNOSED", "WAITING_PARTS", "REPAIRING", "COMPLETED", "DELIVERED"];
  const problems = ["Broken LCD", "Touch not working", "Charging issue", "Battery drain", "No display", "Speaker fault"];
  const techUser = await db.user.create({
    data: { email: "tech@cellcity.com", name: "Ali Technician", passwordHash: "demo", role: "TECHNICIAN", phone: "+92 311 0000000" },
  }).catch(async () => await db.user.findFirst({ where: { email: "tech@cellcity.com" } })!);
  const modelIds = allModels.map(([, id]) => id);
  for (let i = 0; i < 8; i++) {
    const createdAt = new Date(now.getTime() - i * 43200000);
    const ticketNo = `RPR-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`;
    const laborCost = Math.round((Math.random() * 2000 + 500) / 100) * 100;
    try {
      await db.repairJob.create({
        data: {
          ticketNo,
          customerId: customerIds[Math.floor(Math.random() * customerIds.length)] ?? null,
          modelId: modelIds[Math.floor(Math.random() * modelIds.length)],
          technicianId: (techUser as any)?.id,
          imei: `${Math.floor(Math.random() * 9e14 + 1e15)}`,
          problem: problems[Math.floor(Math.random() * problems.length)],
          status: repairStatuses[Math.floor(Math.random() * repairStatuses.length)],
          laborCost,
          total: laborCost,
          paid: Math.random() > 0.5 ? laborCost : 0,
          paymentStatus: Math.random() > 0.5 ? "PAID" : "UNPAID",
          createdAt,
        },
      });
    } catch {
      /* dup */
    }
  }
  console.log("✅ Demo repair jobs created");

  // ── Demo Damaged Inventory ───────────────────────────────
  for (let i = 0; i < 6; i++) {
    const p = products[Math.floor(Math.random() * products.length)];
    try {
      await db.damagedInventory.create({
        data: {
          productId: p.id,
          qty: Math.floor(Math.random() * 3) + 1,
          reason: ["BROKEN", "DEAD", "WARRANTY", "RETURNED", "REJECTED"][Math.floor(Math.random() * 5)],
          note: "Damaged during testing",
          date: new Date(now.getTime() - i * 86400000),
        },
      });
    } catch {
      /* */
    }
  }

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
