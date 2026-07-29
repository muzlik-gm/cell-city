import { getCurrentSession } from "./auth";

/// Returns the active business ID for the current session, or null if not authenticated.
/// All data APIs should use this to scope their queries by businessId.
export async function getBusinessId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.business?.id ?? null;
}

/// Throws a 401 error if not authenticated with a business.
export async function requireBusiness(): Promise<string> {
  const id = await getBusinessId();
  if (!id) throw new Error("Not authenticated with a business");
  return id;
}
