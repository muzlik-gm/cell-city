/* Realistic deterministic seed for Cell City — Mobile Spare Parts Management.
 * No Math.random — all values are realistic and consistent.
 * Run: bun run prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log("🌱 Seeding Cell City database (fresh, deterministic)...");

  // ── Settings ─────────────────────────────────────────────
  const settings: Record<string, string> = {
    business_name: "Cell City",
    business_phone: "+92 21 34567890",
    business_address: "Shop 14, Mobile Market, Saddar, Karachi, Pakistan",
    business_email: "info@cellcity.pk",
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

  // ── Users ────────────────────────────────────────────────
  const users = [
    { name: "Bilal Ahmed", email: "owner@cellcity.pk", role: "OWNER", phone: "+92 300 1234567" },
    { name: "Usman Khan", email: "manager@cellcity.pk", role: "MANAGER", phone: "+92 301 2345678" },
    { name: "Ali Raza", email: "tech@cellcity.pk", role: "TECHNICIAN", phone: "+92 311 0000001" },
    { name: "Hamza Sheikh", email: "sales@cellcity.pk", role: "SALES_STAFF", phone: "+92 321 0000002" },
  ];
  const userMap: Record<string, string> = {};
  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, phone: u.phone },
      create: { ...u, passwordHash: "$2a$10$placeholder_hash_replace_in_production" },
    });
    userMap[u.role] = user.id;
  }

  // ── Warehouses & Shelves ─────────────────────────────────
  const whMain = await db.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: { name: "Main Shop", code: "WH-MAIN", address: "Shop 14, Mobile Market, Saddar, Karachi" },
  });
  const whBackup = await db.warehouse.upsert({
    where: { code: "WH-BKP" },
    update: {},
    create: { name: "Storage Room", code: "WH-BKP", address: "Back storage, Karachi" },
  });

  const shelves = [
    { code: "A1", warehouseId: whMain.id, rack: "A", bin: "1", description: "Samsung LCDs" },
    { code: "A2", warehouseId: whMain.id, rack: "A", bin: "2", description: "iPhone LCDs" },
    { code: "A3", warehouseId: whMain.id, rack: "A", bin: "3", description: "Xiaomi LCDs" },
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
  const brandData = [
    { name: "Samsung", country: "South Korea" },
    { name: "Apple", country: "USA" },
    { name: "Xiaomi", country: "China" },
    { name: "Oppo", country: "China" },
    { name: "Vivo", country: "China" },
    { name: "Realme", country: "China" },
    { name: "Infinix", country: "China" },
    { name: "Tecno", country: "China" },
    { name: "Huawei", country: "China" },
    { name: "Nokia", country: "Finland" },
  ];
  const brandMap: Record<string, string> = {};
  for (const b of brandData) {
    const brand = await db.brand.upsert({
      where: { slug: slug(b.name) },
      update: { country: b.country },
      create: { name: b.name, slug: slug(b.name), country: b.country },
    });
    brandMap[b.name] = brand.id;
  }

  // ── Phone Models with realistic compatibility groups ────
  // Each group = models that share the same LCD/Touch/Battery/Frame
  const modelGroups: { name: string; brand: string; year?: number }[][] = [
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
    [
      { name: "Redmi Note 8", brand: "Xiaomi", year: 2019 },
      { name: "Redmi Note 8 Pro", brand: "Xiaomi", year: 2019 },
    ],
    [
      { name: "Redmi 9A", brand: "Xiaomi", year: 2020 },
      { name: "Redmi 9 Activ", brand: "Xiaomi", year: 2020 },
    ],
    [
      { name: "Oppo A3s", brand: "Oppo", year: 2018 },
      { name: "Oppo A5", brand: "Oppo", year: 2018 },
      { name: "Oppo A5s", brand: "Oppo", year: 2019 },
    ],
    [
      { name: "Vivo Y11", brand: "Vivo", year: 2019 },
      { name: "Vivo Y12", brand: "Vivo", year: 2019 },
      { name: "Vivo Y15", brand: "Vivo", year: 2019 },
    ],
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
        update: { brandId: brandMap[m.brand], releaseYear: m.year },
        create: { name: m.name, slug: slug(m.name), brandId: brandMap[m.brand], releaseYear: m.year },
      });
      modelMap[m.name] = model.id;
    }
    // Bidirectional compatibility links for all part types
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = modelMap[group[i].name];
        const b = modelMap[group[j].name];
        for (const pt of ["LCD", "TOUCH", "BATTERY", "FRAME", "FLEX"]) {
          await db.modelCompatibility.upsert({
            where: { modelId_peerId_partType: { modelId: a, peerId: b, partType: pt } },
            update: {},
            create: { modelId: a, peerId: b, partType: pt, note: `Shared ${pt.toLowerCase()}` },
          });
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
      update: { category: p.category },
      create: { name: p.name, slug: slug(p.name), category: p.category },
    });
    ptMap[p.name] = pt.id;
  }

  // ── Suppliers (realistic Pakistani/Chinese suppliers) ───
  const supplierData = [
    { name: "Guangzhou Display Co.", company: "GZ Display Ltd", phone: "+86 138 0000 1111", whatsapp: "+8613800001111", email: "sales@gzdisplay.cn", address: "Guangzhou, China", contactPerson: "Wang Li", rating: 5 },
    { name: "Shenzhen Parts Hub", company: "SZ Parts Hub", phone: "+86 139 2222 3333", whatsapp: "+8613922223333", email: "info@szpartshub.cn", address: "Shenzhen, China", contactPerson: "Chen Wei", rating: 4 },
    { name: "Karachi Wholesale Market", company: "KWM Traders", phone: "+92 333 1234567", whatsapp: "+923331234567", email: "kwm@local.pk", address: "Light House, Karachi", contactPerson: "Imran Khan", rating: 4 },
    { name: "Dubai Mobile Hub", company: "DMH FZE", phone: "+971 50 123 4567", whatsapp: "+971501234567", email: "contact@dmh.ae", address: "Deira, Dubai", contactPerson: "Ahmed Al Rashid", rating: 5 },
  ];
  const supMap: Record<string, string> = {};
  for (const s of supplierData) {
    const existing = await db.supplier.findFirst({ where: { name: s.name } });
    const sup = existing
      ? await db.supplier.update({ where: { id: existing.id }, data: s })
      : await db.supplier.create({ data: s });
    supMap[s.name] = sup.id;
  }

  // ── Customers ────────────────────────────────────────────
  const customerData = [
    { name: "Ahmed Mobile Shop", phone: "+92 301 1111111", whatsapp: "+923011111111", address: "Saddar, Karachi", company: "Ahmed Mobiles" },
    { name: "Bilal Repair Center", phone: "+92 302 2222222", whatsapp: "+923022222222", address: "Gulshan, Karachi", company: "Bilal Repairs" },
    { name: "Usman Cell Point", phone: "+92 303 3333333", whatsapp: "+923033333333", address: "Korangi, Karachi", company: "Usman Cell" },
    { name: "Walk-in Customer", phone: "", address: "" },
  ];
  const custMap: Record<string, string> = {};
  for (const c of customerData) {
    const existing = await db.customer.findFirst({ where: { name: c.name } });
    const cust = existing
      ? await db.customer.update({ where: { id: existing.id }, data: c })
      : await db.customer.create({ data: c });
    custMap[c.name] = cust.id;
  }

  // ── Products (realistic, deterministic) ─────────────────
  // Each product has realistic prices (PKR), stock levels, shelf locations.
  // Stock is deliberately varied: some well-stocked, some low, some out.
  const productSpecs: {
    model: string; part: string; quality: string; color?: string;
    cost: number; price: number; stock: number; minStock: number;
    shelf: string; connector?: string; lcdCode?: string; supplier: string;
  }[] = [
    // Samsung A12 family (LCD, Touch, Battery, Frame, Charging Flex)
    { model: "Samsung Galaxy A12", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 4200, price: 6500, stock: 14, minStock: 5, shelf: "A1", lcdCode: "SA-1001", supplier: "Guangzhou Display Co." },
    { model: "Samsung Galaxy A12", part: "LCD", quality: "OEM", color: "Black", cost: 2800, price: 4500, stock: 8, minStock: 5, shelf: "A1", lcdCode: "SA-1002", supplier: "Guangzhou Display Co." },
    { model: "Samsung Galaxy A12", part: "LCD", quality: "COPY", color: "Black", cost: 1500, price: 2500, stock: 22, minStock: 8, shelf: "A1", lcdCode: "SA-1003", supplier: "Shenzhen Parts Hub" },
    { model: "Samsung Galaxy A12", part: "Touch Glass", quality: "ORIGINAL", cost: 800, price: 1500, stock: 10, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },
    { model: "Samsung Galaxy A12", part: "Battery", quality: "ORIGINAL", cost: 600, price: 1200, stock: 18, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },
    { model: "Samsung Galaxy A12", part: "Frame", quality: "OEM", color: "Black", cost: 500, price: 1000, stock: 7, minStock: 3, shelf: "C1", supplier: "Karachi Wholesale Market" },
    { model: "Samsung Galaxy A12", part: "Charging Flex", quality: "ORIGINAL", cost: 250, price: 600, stock: 15, minStock: 5, shelf: "B2", connector: "Type-C", supplier: "Shenzhen Parts Hub" },

    // Samsung A50 family
    { model: "Samsung Galaxy A50", part: "OLED", quality: "ORIGINAL", color: "Black", cost: 12000, price: 18000, stock: 6, minStock: 3, shelf: "A1", lcdCode: "SA-2001", supplier: "Guangzhou Display Co." },
    { model: "Samsung Galaxy A50", part: "OLED", quality: "COPY", color: "Black", cost: 5000, price: 9000, stock: 12, minStock: 5, shelf: "A1", lcdCode: "SA-2002", supplier: "Shenzhen Parts Hub" },
    { model: "Samsung Galaxy A50", part: "Battery", quality: "ORIGINAL", cost: 700, price: 1400, stock: 20, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },
    { model: "Samsung Galaxy A50", part: "Touch Glass", quality: "OEM", cost: 1000, price: 1800, stock: 4, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },

    // Samsung A22
    { model: "Samsung Galaxy A22", part: "OLED", quality: "ORIGINAL", color: "Black", cost: 9000, price: 14000, stock: 5, minStock: 3, shelf: "A1", lcdCode: "SA-3001", supplier: "Guangzhou Display Co." },
    { model: "Samsung Galaxy A22", part: "Battery", quality: "ORIGINAL", cost: 650, price: 1300, stock: 16, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // iPhone 11 family
    { model: "iPhone 11", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 8000, price: 13000, stock: 9, minStock: 3, shelf: "A2", lcdCode: "IP-1001", supplier: "Guangzhou Display Co." },
    { model: "iPhone 11", part: "LCD", quality: "OEM", color: "Black", cost: 5500, price: 9000, stock: 11, minStock: 5, shelf: "A2", lcdCode: "IP-1002", supplier: "Shenzhen Parts Hub" },
    { model: "iPhone 11", part: "Battery", quality: "ORIGINAL", cost: 1200, price: 2500, stock: 14, minStock: 5, shelf: "B1", supplier: "Dubai Mobile Hub" },
    { model: "iPhone 11", part: "Frame", quality: "OEM", color: "Black", cost: 1500, price: 3000, stock: 6, minStock: 3, shelf: "C1", supplier: "Dubai Mobile Hub" },
    { model: "iPhone 11", part: "Charging Flex", quality: "ORIGINAL", cost: 500, price: 1200, stock: 8, minStock: 3, shelf: "B2", connector: "Lightning", supplier: "Shenzhen Parts Hub" },

    // iPhone X
    { model: "iPhone X", part: "OLED", quality: "ORIGINAL", color: "Black", cost: 15000, price: 22000, stock: 4, minStock: 3, shelf: "A2", lcdCode: "IP-2001", supplier: "Guangzhou Display Co." },
    { model: "iPhone X", part: "Battery", quality: "ORIGINAL", cost: 1000, price: 2200, stock: 10, minStock: 5, shelf: "B1", supplier: "Dubai Mobile Hub" },

    // iPhone 13
    { model: "iPhone 13", part: "OLED", quality: "ORIGINAL", color: "Black", cost: 20000, price: 28000, stock: 3, minStock: 3, shelf: "A2", lcdCode: "IP-3001", supplier: "Guangzhou Display Co." },
    { model: "iPhone 13", part: "Battery", quality: "ORIGINAL", cost: 1500, price: 3000, stock: 7, minStock: 3, shelf: "B1", supplier: "Dubai Mobile Hub" },

    // Redmi Note 8
    { model: "Redmi Note 8", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3500, price: 5500, stock: 13, minStock: 5, shelf: "A3", lcdCode: "XM-1001", supplier: "Guangzhou Display Co." },
    { model: "Redmi Note 8", part: "LCD", quality: "COPY", color: "Black", cost: 1800, price: 3000, stock: 25, minStock: 8, shelf: "A3", lcdCode: "XM-1002", supplier: "Shenzhen Parts Hub" },
    { model: "Redmi Note 8", part: "Battery", quality: "ORIGINAL", cost: 500, price: 1100, stock: 19, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },
    { model: "Redmi Note 8", part: "Touch Glass", quality: "OEM", cost: 700, price: 1300, stock: 9, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },

    // Redmi 9A
    { model: "Redmi 9A", part: "LCD", quality: "COPY", color: "Black", cost: 1200, price: 2200, stock: 30, minStock: 10, shelf: "A3", lcdCode: "XM-2001", supplier: "Shenzhen Parts Hub" },
    { model: "Redmi 9A", part: "Battery", quality: "ORIGINAL", cost: 450, price: 950, stock: 22, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Oppo A5s
    { model: "Oppo A5s", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3000, price: 5000, stock: 11, minStock: 5, shelf: "A3", lcdCode: "OP-1001", supplier: "Guangzhou Display Co." },
    { model: "Oppo A5s", part: "Touch Glass", quality: "OEM", cost: 600, price: 1200, stock: 14, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },
    { model: "Oppo A5s", part: "Battery", quality: "ORIGINAL", cost: 550, price: 1100, stock: 17, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Vivo Y11
    { model: "Vivo Y11", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3200, price: 5200, stock: 8, minStock: 5, shelf: "A3", lcdCode: "VV-1001", supplier: "Guangzhou Display Co." },
    { model: "Vivo Y11", part: "Battery", quality: "ORIGINAL", cost: 500, price: 1050, stock: 15, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Infinix Hot 10
    { model: "Infinix Hot 10", part: "LCD", quality: "COPY", color: "Black", cost: 1400, price: 2500, stock: 28, minStock: 10, shelf: "A3", lcdCode: "IX-1001", supplier: "Shenzhen Parts Hub" },
    { model: "Infinix Hot 10", part: "Battery", quality: "ORIGINAL", cost: 480, price: 1000, stock: 20, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Tecno Spark 6
    { model: "Tecno Spark 6", part: "LCD", quality: "COPY", color: "Black", cost: 1300, price: 2300, stock: 18, minStock: 8, shelf: "A3", lcdCode: "TN-1001", supplier: "Shenzhen Parts Hub" },
    { model: "Tecno Spark 6", part: "Touch Glass", quality: "COPY", cost: 400, price: 900, stock: 12, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },

    // Realme C11
    { model: "Realme C11", part: "LCD", quality: "COPY", color: "Black", cost: 1100, price: 2000, stock: 24, minStock: 10, shelf: "A3", lcdCode: "RM-1001", supplier: "Shenzhen Parts Hub" },
    { model: "Realme C11", part: "Battery", quality: "ORIGINAL", cost: 450, price: 950, stock: 16, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Huawei Y7
    { model: "Huawei Y7 Prime", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3800, price: 6000, stock: 7, minStock: 5, shelf: "A3", lcdCode: "HW-1001", supplier: "Guangzhou Display Co." },
    { model: "Huawei Y7 Prime", part: "Battery", quality: "ORIGINAL", cost: 600, price: 1200, stock: 13, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },

    // Nokia 2.4
    { model: "Nokia 2.4", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3500, price: 5500, stock: 5, minStock: 3, shelf: "A3", lcdCode: "NK-1001", supplier: "Guangzhou Display Co." },
    { model: "Nokia 2.4", part: "Battery", quality: "ORIGINAL", cost: 550, price: 1100, stock: 11, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale Market" },
  ];

  // Create products
  let skuCounter = 1001;
  for (const spec of productSpecs) {
    const modelId = modelMap[spec.model];
    const partTypeId = ptMap[spec.part];
    if (!modelId || !partTypeId) continue;
    const brand = spec.model.split(" ")[0];
    const brandId = brandMap[brand] ?? brandMap["Samsung"];
    const sku = `CC-${skuCounter++}`;
    const name = `${spec.model} ${spec.part} ${spec.quality}${spec.color ? " " + spec.color : ""}`.trim();

    const existing = await db.product.findUnique({ where: { sku } });
    const product = existing
      ? await db.product.update({
          where: { id: existing.id },
          data: {
            name, brandId, modelId, partTypeId,
            quality: spec.quality, condition: "NEW", color: spec.color ?? null,
            supplierId: supMap[spec.supplier] ?? null,
            purchasePrice: spec.cost, sellingPrice: spec.price,
            stock: spec.stock, minStock: spec.minStock,
            warehouseId: whMain.id, shelfId: shelfMap[spec.shelf],
            connectorType: spec.connector ?? null, lcdCode: spec.lcdCode ?? null,
            notes: spec.quality === "COPY" ? "Copy quality — verify connector version" : spec.quality === "OEM" ? "OEM grade" : "Original stock",
          },
        })
      : await db.product.create({
          data: {
            sku, barcode: `890${skuCounter}`, qrCode: sku, name,
            brandId, modelId, partTypeId,
            quality: spec.quality, condition: "NEW", color: spec.color ?? null,
            supplierId: supMap[spec.supplier] ?? null,
            purchasePrice: spec.cost, sellingPrice: spec.price,
            stock: spec.stock, minStock: spec.minStock,
            warehouseId: whMain.id, shelfId: shelfMap[spec.shelf],
            connectorType: spec.connector ?? null, lcdCode: spec.lcdCode ?? null,
            notes: spec.quality === "COPY" ? "Copy quality — verify connector version" : spec.quality === "OEM" ? "OEM grade" : "Original stock",
          },
        });

    // Price history
    await db.priceHistory.create({
      data: {
        productId: product.id,
        supplierId: supMap[spec.supplier] ?? null,
        purchasePrice: spec.cost,
        sellingPrice: spec.price,
        note: "Initial stock",
      },
    });
    // Stock-in movement
    await db.inventoryMovement.create({
      data: {
        productId: product.id,
        toWarehouseId: whMain.id,
        qty: spec.stock,
        type: "IN",
        ref: "INITIAL",
        note: "Initial stock",
      },
    });
  }
  console.log(`✅ ${productSpecs.length} products created`);

  // ── Recent Sales (last 7 days, deterministic) ────────────
  const customerIds = Object.values(custMap);
  const products = await db.product.findMany({ where: { active: true, stock: { gt: 0 } } });
  const now = new Date();
  // Deterministic sale selection — rotate through products
  let saleDay = 0;
  let saleIdx = 0;
  for (let d = 6; d >= 0; d--) {
    const salesToday = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 2 : d === 3 ? 4 : d === 4 ? 2 : d === 5 ? 3 : 2;
    for (let s = 0; s < salesToday; s++) {
      const p = products[saleIdx % products.length];
      saleIdx++;
      const qty = (saleIdx % 3) + 1; // 1-3 units
      if (p.stock < qty) continue;
      const lineTotal = p.sellingPrice * qty;
      const profit = (p.sellingPrice - p.purchasePrice) * qty;
      const createdAt = new Date(now.getTime() - d * 86400000 - s * 3600000);
      const invNo = `INV-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${String(saleIdx).padStart(3, "0")}`;
      try {
        await db.sale.create({
          data: {
            invoiceNo: invNo,
            customerId: customerIds[saleIdx % customerIds.length],
            userId: userMap["SALES_STAFF"],
            subtotal: lineTotal, discount: 0, tax: 0, total: lineTotal,
            profit, paid: lineTotal,
            paymentMethod: ["CASH", "CARD", "BANK", "MOBILE"][saleIdx % 4],
            paymentStatus: "PAID", status: "COMPLETED",
            createdAt,
            items: {
              create: {
                productId: p.id, name: p.name, qty, price: p.sellingPrice,
                cost: p.purchasePrice, discount: 0, total: lineTotal,
              },
            },
          },
        });
      } catch { /* dup invoice */ }
    }
    saleDay++;
  }
  console.log("✅ Recent sales created");

  // ── Recent Purchases (last 14 days) ──────────────────────
  const supplierIds = Object.values(supMap);
  let poIdx = 0;
  for (let d = 13; d >= 0; d -= 2) {
    const itemCount = (poIdx % 3) + 2; // 2-4 items
    let subtotal = 0;
    const items: any[] = [];
    for (let i = 0; i < itemCount; i++) {
      const p = products[poIdx % products.length];
      const qty = ((poIdx + i) % 10) + 5; // 5-14 units
      const lineTotal = p.purchasePrice * qty;
      subtotal += lineTotal;
      items.push({ productId: p.id, name: p.name, qty, cost: p.purchasePrice, price: p.purchasePrice, total: lineTotal });
      poIdx++;
    }
    const createdAt = new Date(now.getTime() - d * 86400000);
    const poNo = `PO-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${String(poIdx).padStart(3, "0")}`;
    try {
      await db.purchase.create({
        data: {
          poNo,
          supplierId: supplierIds[poIdx % supplierIds.length],
          userId: userMap["MANAGER"],
          subtotal, discount: 0, tax: 0, total: subtotal,
          paid: subtotal, paymentStatus: "PAID", status: "RECEIVED",
          createdAt,
          items: { create: items },
        },
      });
    } catch { /* dup */ }
  }
  console.log("✅ Recent purchases created");

  // ── Repair Jobs ──────────────────────────────────────────
  const repairData = [
    { customer: "Ahmed Mobile Shop", model: "Samsung Galaxy A12", problem: "Broken LCD — needs replacement", status: "RECEIVED", labor: 500 },
    { customer: "Bilal Repair Center", model: "iPhone 11", problem: "Touch not working after drop", status: "DIAGNOSED", labor: 800 },
    { customer: "Usman Cell Point", model: "Redmi Note 8", problem: "Charging issue — port damaged", status: "WAITING_PARTS", labor: 600 },
    { customer: "Walk-in Customer", model: "Oppo A5s", problem: "Battery draining fast", status: "REPAIRING", labor: 400 },
    { customer: "Ahmed Mobile Shop", model: "Vivo Y11", problem: "No display after water damage", status: "COMPLETED", labor: 1000 },
    { customer: "Walk-in Customer", model: "Samsung Galaxy A50", problem: "Speaker crackling", status: "DELIVERED", labor: 300 },
  ];
  let repairIdx = 0;
  for (const r of repairData) {
    const createdAt = new Date(now.getTime() - repairIdx * 43200000);
    const ticketNo = `RPR-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(repairIdx + 1).padStart(4, "0")}`;
    try {
      await db.repairJob.create({
        data: {
          ticketNo,
          customerId: custMap[r.customer],
          modelId: modelMap[r.model],
          technicianId: userMap["TECHNICIAN"],
          imei: String(350000000000000 + repairIdx * 111111111111),
          problem: r.problem,
          status: r.status,
          laborCost: r.labor, partsCost: 0, total: r.labor,
          paid: r.status === "DELIVERED" || r.status === "COMPLETED" ? r.labor : 0,
          paymentStatus: r.status === "DELIVERED" || r.status === "COMPLETED" ? "PAID" : "UNPAID",
          createdAt,
          completedAt: r.status === "COMPLETED" || r.status === "DELIVERED" ? new Date(createdAt.getTime() + 86400000) : null,
          deliveredAt: r.status === "DELIVERED" ? new Date(createdAt.getTime() + 2 * 86400000) : null,
        },
      });
    } catch { /* dup */ }
    repairIdx++;
  }
  console.log("✅ Repair jobs created");

  // ── Damaged Inventory ────────────────────────────────────
  const damageData = [
    { idx: 0, qty: 2, reason: "BROKEN", note: "Cracked during installation" },
    { idx: 1, qty: 1, reason: "DEAD", note: "DoA from supplier" },
    { idx: 2, qty: 3, reason: "WARRANTY", note: "Customer return — warranty claim" },
    { idx: 3, qty: 1, reason: "REJECTED", note: "Failed QC" },
  ];
  for (const d of damageData) {
    const p = products[d.idx % products.length];
    try {
      await db.damagedInventory.create({
        data: {
          productId: p.id, qty: d.qty, reason: d.reason, note: d.note,
          date: new Date(now.getTime() - d.idx * 86400000),
        },
      });
    } catch { /* */ }
  }
  console.log("✅ Damaged inventory created");

  console.log("🎉 Cell City database seeded successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
