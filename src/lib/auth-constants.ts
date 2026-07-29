// Client-safe auth constants and helpers (no server-only imports).

// Rank hierarchy — higher = more access (for employees within a business)
export const RANK_ORDER: Record<string, number> = {
  WAREHOUSE_STAFF: 1,
  TECHNICIAN: 2,
  SALES_STAFF: 3,
  MANAGER: 4,
  OWNER: 5,
};

export const RANK_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES_STAFF: "Sales Staff",
  TECHNICIAN: "Technician",
  WAREHOUSE_STAFF: "Warehouse Staff",
};

// Which nav views each rank can access
export const RANK_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings", "admin"],
  MANAGER: ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings", "admin"],
  SALES_STAFF: ["home", "inventory", "sales", "repairs"],
  TECHNICIAN: ["home", "inventory", "repairs"],
  WAREHOUSE_STAFF: ["home", "inventory", "purchases"],
};

// App users (business owners) have full access
export const APP_USER_PERMISSIONS = ["home", "inventory", "sales", "purchases", "repairs", "reports", "settings", "admin"];

export function hasPermission(rankOrType: string, view: string): boolean {
  if (rankOrType === "app_user") return APP_USER_PERMISSIONS.includes(view);
  const perms = RANK_PERMISSIONS[rankOrType] ?? [];
  return perms.includes(view);
}

export function isOwnerOrFounder(rank: string): boolean {
  return rank === "OWNER" || rank === "MANAGER"; // managers can also manage employees
}

export function canManageEmployees(rankOrType: string): boolean {
  if (rankOrType === "app_user") return true;
  return rank === "OWNER" || rank === "MANAGER";
}
