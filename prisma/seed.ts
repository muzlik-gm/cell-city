/* Seed for Cell City — creates an AppUser, a Business, Employees, and demo data.
 * Run: bun run prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log("🌱 Seeding Cell City...");

  // ── App User (business owner) ────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);
  const appUser = await db.appUser.upsert({
    where: { username: "bilal" },
    update: { email: "bilal@cellcity.pk", name: "Bilal Ahmed", passwordHash, phone: "+92 300 1234567" },
    create: { username: "bilal", email: "bilal@cellcity.pk", name: "Bilal Ahmed", passwordHash, phone: "+92 300 1234567" },
  });

  // ── Business ─────────────────────────────────────────────
  const business = await db.business.upsert({
    where: { ownerId_handle: { ownerId: appUser.id, handle: "cell-city" } },
    update: { name: "Cell City", plan: "PRO" },
    create: { name: "Cell City", handle: "cell-city", ownerId: appUser.id, plan: "PRO" },
  });

  // ── Employees (sub-accounts scoped to this business) ─────
  const employees = [
    { name: "Usman Khan", username: "usman", rank: "MANAGER", phone: "+92 301 2345678" },
    { name: "Ali Raza", username: "ali", rank: "TECHNICIAN", phone: "+92 311 0000001" },
    { name: "Hamza Sheikh", username: "hamza", rank: "SALES_STAFF", phone: "+92 321 0000002" },
  ];
  for (const e of employees) {
    await db.employee.upsert({
      where: { businessId_username: { businessId: business.id, username: e.username } },
      update: { name: e.name, rank: e.rank, phone: e.phone, passwordHash },
      create: { ...e, passwordHash, businessId: business.id },
    });
  }

  // ── Settings (scoped to business) ────────────────────────
  const settings: Record<string, string> = {
    business_name: "Cell City",
    business_phone: "+92 21 34567890",
    business_address: "Shop 14, Mobile Market, Saddar, Karachi",
    business_email: "info@cellcity.pk",
    currency: "PKR", currency_symbol: "Rs",
    tax_rate: "0", tax_name: "Sales Tax",
    invoice_prefix: "INV", po_prefix: "PO", ticket_prefix: "RPR",
    low_stock_threshold: "5", theme: "light", language: "en",
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { key: `${business.id}_${k}` },
      update: { value: v, businessId: business.id },
      create: { key: `${business.id}_${k}`, value: v, businessId: business.id },
    });
  }

  // ── Warehouses & Shelves (scoped to business) ────────────
  const whMain = await db.warehouse.upsert({
    where: { code: `${business.id}-WH-MAIN` },
    update: {},
    create: { name: "Main Shop", code: `${business.id}-WH-MAIN`, address: "Shop 14, Mobile Market, Saddar, Karachi", businessId: business.id },
  });
  const shelves = [
    { code: "A1", warehouseId: whMain.id, rack: "A", bin: "1", description: "Samsung LCDs" },
    { code: "A2", warehouseId: whMain.id, rack: "A", bin: "2", description: "iPhone LCDs" },
    { code: "A3", warehouseId: whMain.id, rack: "A", bin: "3", description: "Xiaomi LCDs" },
    { code: "B1", warehouseId: whMain.id, rack: "B", bin: "1", description: "Batteries" },
    { code: "B2", warehouseId: whMain.id, rack: "B", bin: "2", description: "Flex Cables" },
    { code: "C1", warehouseId: whMain.id, rack: "C", bin: "1", description: "Frames" },
    { code: "C2", warehouseId: whMain.id, rack: "C", bin: "2", description: "Touch Glass" },
  ];
  const shelfMap: Record<string, string> = {};
  for (const s of shelves) {
    const sh = await db.shelf.upsert({
      where: { warehouseId_code: { warehouseId: s.warehouseId, code: s.code } },
      update: {}, create: s,
    });
    shelfMap[s.code] = sh.id;
  }

  // ── Brands (scoped to business) ──────────────────────────
  const brandData = [
    { name: "Samsung", country: "South Korea" },
    { name: "Apple", country: "USA" },
    { name: "Xiaomi", country: "China" },
    { name: "Oppo", country: "China" },
    { name: "Vivo", country: "China" },
    { name: "Infinix", country: "China" },
  ];
  const brandMap: Record<string, string> = {};
  for (const b of brandData) {
    const brand = await db.brand.create({ data: { name: b.name, slug: slug(b.name), country: b.country, businessId: business.id } }).catch(() => null);
    if (brand) brandMap[b.name] = brand.id;
    else {
      const existing = await db.brand.findFirst({ where: { name: b.name, businessId: business.id } });
      if (existing) brandMap[b.name] = existing.id;
    }
  }

  // ── Phone Models with compatibility groups ───────────────
  const modelGroups: { name: string; brand: string; year?: number }[][] = [
    [
      { name: "Samsung Galaxy A12", brand: "Samsung", year: 2020 },
      { name: "Samsung Galaxy M12", brand: "Samsung", year: 2021 },
      { name: "Samsung Galaxy F12", brand: "Samsung", year: 2021 },
    ],
    [
      { name: "iPhone 11", brand: "Apple", year: 2019 },
      { name: "iPhone 11 Pro", brand: "Apple", year: 2019 },
    ],
    [
      { name: "Redmi Note 8", brand: "Xiaomi", year: 2019 },
      { name: "Redmi Note 8 Pro", brand: "Xiaomi", year: 2019 },
    ],
    [
      { name: "Oppo A5s", brand: "Oppo", year: 2019 },
    ],
    [
      { name: "Vivo Y11", brand: "Vivo", year: 2019 },
    ],
    [
      { name: "Infinix Hot 10", brand: "Infinix", year: 2020 },
    ],
  ];
  const modelMap: Record<string, string> = {};
  for (const group of modelGroups) {
    for (const m of group) {
      const model = await db.phoneModel.create({
        data: { name: m.name, slug: slug(m.name), brandId: brandMap[m.brand], releaseYear: m.year, businessId: business.id },
      }).catch(() => null);
      if (model) modelMap[m.name] = model.id;
    }
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = modelMap[group[i].name];
        const b = modelMap[group[j].name];
        if (!a || !b) continue;
        for (const pt of ["LCD", "TOUCH", "BATTERY", "FRAME"]) {
          await db.modelCompatibility.upsert({
            where: { modelId_peerId_partType: { modelId: a, peerId: b, partType: pt } },
            update: {}, create: { modelId: a, peerId: b, partType: pt },
          }).catch(() => {});
        }
      }
    }
  }

  // ── Part Types ───────────────────────────────────────────
  const partTypes = [
    { name: "LCD", category: "Display" }, { name: "OLED", category: "Display" },
    { name: "Touch Glass", category: "Display" }, { name: "Battery", category: "Power" },
    { name: "Frame", category: "Housing" }, { name: "Charging Flex", category: "Flex" },
    { name: "Front Camera", category: "Camera" }, { name: "Speaker", category: "Audio" },
  ];
  const ptMap: Record<string, string> = {};
  for (const p of partTypes) {
    const pt = await db.partType.create({ data: { name: p.name, slug: slug(p.name), category: p.category, businessId: business.id } }).catch(() => null);
    if (pt) ptMap[p.name] = pt.id;
  }

  // ── Suppliers ────────────────────────────────────────────
  const supplierData = [
    { name: "Guangzhou Display Co.", company: "GZ Display Ltd", phone: "+86 138 0000 1111", rating: 5 },
    { name: "Shenzhen Parts Hub", company: "SZ Parts Hub", phone: "+86 139 2222 3333", rating: 4 },
    { name: "Karachi Wholesale", company: "KWM Traders", phone: "+92 333 1234567", rating: 4 },
  ];
  const supMap: Record<string, string> = {};
  for (const s of supplierData) {
    const sup = await db.supplier.create({ data: { ...s, businessId: business.id } }).catch(() => null);
    if (sup) supMap[s.name] = sup.id;
  }

  // ── Customers ────────────────────────────────────────────
  const customerData = [
    { name: "Ahmed Mobile Shop", phone: "+92 301 1111111", company: "Ahmed Mobiles" },
    { name: "Bilal Repair Center", phone: "+92 302 2222222", company: "Bilal Repairs" },
    { name: "Walk-in Customer", phone: "" },
  ];
  const custMap: Record<string, string> = {};
  for (const c of customerData) {
    const cust = await db.customer.create({ data: { ...c, businessId: business.id } }).catch(() => null);
    if (cust) custMap[c.name] = cust.id;
  }

  // ── Products (realistic deterministic) ───────────────────
  const productSpecs = [
    { model: "Samsung Galaxy A12", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 4200, price: 6500, stock: 14, minStock: 5, shelf: "A1", lcdCode: "SA-1001", supplier: "Guangzhou Display Co." },
    { model: "Samsung Galaxy A12", part: "LCD", quality: "COPY", color: "Black", cost: 1500, price: 2500, stock: 22, minStock: 8, shelf: "A1", lcdCode: "SA-1003", supplier: "Shenzhen Parts Hub" },
    { model: "Samsung Galaxy A12", part: "Touch Glass", quality: "ORIGINAL", cost: 800, price: 1500, stock: 10, minStock: 5, shelf: "C2", supplier: "Shenzhen Parts Hub" },
    { model: "Samsung Galaxy A12", part: "Battery", quality: "ORIGINAL", cost: 600, price: 1200, stock: 18, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale" },
    { model: "Samsung Galaxy A12", part: "Frame", quality: "OEM", color: "Black", cost: 500, price: 1000, stock: 7, minStock: 3, shelf: "C1", supplier: "Karachi Wholesale" },
    { model: "iPhone 11", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 8000, price: 13000, stock: 9, minStock: 3, shelf: "A2", lcdCode: "IP-1001", supplier: "Guangzhou Display Co." },
    { model: "iPhone 11", part: "Battery", quality: "ORIGINAL", cost: 1200, price: 2500, stock: 14, minStock: 5, shelf: "B1", supplier: "Guangzhou Display Co." },
    { model: "Redmi Note 8", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3500, price: 5500, stock: 13, minStock: 5, shelf: "A3", lcdCode: "XM-1001", supplier: "Guangzhou Display Co." },
    { model: "Redmi Note 8", part: "Battery", quality: "ORIGINAL", cost: 500, price: 1100, stock: 19, minStock: 5, shelf: "B1", supplier: "Karachi Wholesale" },
    { model: "Oppo A5s", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3000, price: 5000, stock: 11, minStock: 5, shelf: "A3", lcdCode: "OP-1001", supplier: "Guangzhou Display Co." },
    { model: "Vivo Y11", part: "LCD", quality: "ORIGINAL", color: "Black", cost: 3200, price: 5200, stock: 4, minStock: 5, shelf: "A3", lcdCode: "VV-1001", supplier: "Guangzhou Display Co." },
    { model: "Infinix Hot 10", part: "LCD", quality: "COPY", color: "Black", cost: 1400, price: 2500, stock: 28, minStock: 10, shelf: "A3", lcdCode: "IX-1001", supplier: "Shenzhen Parts Hub" },
  ];

  let skuCounter = 1001;
  for (const spec of productSpecs) {
    const modelId = modelMap[spec.model];
    const partTypeId = ptMap[spec.part];
    if (!modelId || !partTypeId) continue;
    const brandName = spec.model.split(" ")[0];
    const sku = `CC-${skuCounter++}`;
    await db.product.create({
      data: {
        sku, barcode: `890${skuCounter}`, qrCode: sku,
        name: `${spec.model} ${spec.part} ${spec.quality}${spec.color ? " " + spec.color : ""}`.trim(),
        brandId: brandMap[brandName], modelId, partTypeId,
        quality: spec.quality, condition: "NEW", color: spec.color ?? null,
        supplierId: supMap[spec.supplier] ?? null,
        purchasePrice: spec.cost, sellingPrice: spec.price,
        stock: spec.stock, minStock: spec.minStock,
        warehouseId: whMain.id, shelfId: shelfMap[spec.shelf],
        lcdCode: spec.lcdCode ?? null, businessId: business.id,
      },
    }).catch(() => {});
  }

  console.log("✅ Seed complete!");
  console.log("   App User: bilal / password123");
  console.log("   Business handle: cell-city");
  console.log("   Employees: usman, ali, hamza / password123");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
