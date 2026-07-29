// Client-safe auth constants and helpers (no server-only imports).

// Rank hierarchy — higher = more access
export const RANK_ORDER: Record<string, number> = {
  WAREHOUSE_STAFF: 1,
  TECHNICIAN: 2,
  SALES_STAFF: 3,
  MANAGER: 4,
  OWNER: 5,
  FOUNDER: 6,
};

export const RANK_LABELS: Record<string, string> = {
  FOUNDER: "Founder",
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES_STAFF: "Sales Staff",
  TECHNICIAN: "Technician",
  WAREHOUSE_STAFF: "Warehouse Staff",
};

// Which nav views each rank can access
export const RANK_PERMISSIONS: Record<string, string[]> = {
  FOUNDER: ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings", "admin"],
  OWNER: ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings", "admin"],
  MANAGER: ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings"],
  SALES_STAFF: ["home", "inventory", "sales", "repairs"],
  TECHNICIAN: ["home", "inventory", "repairs"],
  WAREHOUSE_STAFF: ["home", "inventory", "purchases"],
};

export function hasPermission(rank: string, view: string): boolean {
  const perms = RANK_PERMISSIONS[rank] ?? [];
  return perms.includes(view);
}

export function isOwnerOrFounder(rank: string): boolean {
  return rank === "OWNER" || rank === "FOUNDER";
}
