// Shared application types and enums used across the system.

export const PART_CATEGORIES = [
  "Display",
  "Power",
  "Housing",
  "Flex",
  "Camera",
  "Audio",
  "Board",
  "Button",
  "Misc",
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const QUALITIES = ["ORIGINAL", "OEM", "COPY", "PREMIUM_COPY", "REFURBISHED"] as const;
export type Quality = (typeof QUALITIES)[number];

export const CONDITIONS = ["NEW", "USED", "REFURBISHED"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const ROLES = ["OWNER", "MANAGER", "SALES_STAFF", "TECHNICIAN", "WAREHOUSE_STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const SALE_STATUSES = ["COMPLETED", "RETURNED"] as const;
export const PAYMENT_STATUSES = ["PAID", "PARTIAL", "UNPAID"] as const;
export const PAYMENT_METHODS = ["CASH", "CARD", "BANK", "MOBILE", "CREDIT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PURCHASE_STATUSES = ["PENDING", "RECEIVED", "CANCELLED"] as const;

export const REPAIR_STATUSES = [
  "RECEIVED",
  "DIAGNOSED",
  "WAITING_PARTS",
  "REPAIRING",
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const DAMAGE_REASONS = ["BROKEN", "DEAD", "WARRANTY", "RETURNED", "REJECTED", "LOST", "DISPOSED"] as const;

export const IMAGE_KINDS = ["FRONT", "BACK", "CONNECTOR", "FLEX", "IC", "PACKAGING", "OTHER"] as const;

export const MOVEMENT_TYPES = ["IN", "OUT", "TRANSFER", "ADJUST", "DAMAGE", "SALE", "PURCHASE", "REPAIR"] as const;

export type ViewKey =
  | "dashboard"
  | "inventory"
  | "compatibility"
  | "products"
  | "transfers"
  | "sales"
  | "purchases"
  | "suppliers"
  | "customers"
  | "payments"
  | "repairs"
  | "ai"
  | "reports"
  | "analytics"
  | "settings";

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
