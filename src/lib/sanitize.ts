// Input sanitization utilities to prevent XSS, SQL injection, and other attacks.

/// Strips HTML tags and dangerous characters from a string.
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/[\x00-\x1f\x7f]/g, "") // remove control characters
    .trim();
}

/// Sanitizes a username — only allows lowercase letters, numbers, hyphens.
export function sanitizeUsername(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.toLowerCase().trim().replace(/[^a-z0-9-]/g, "").slice(0, 30);
}

/// Sanitizes a business handle — only allows lowercase letters, numbers, hyphens.
export function sanitizeHandle(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.toLowerCase().trim().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

/// Validates an email address format.
export function isValidEmail(input: unknown): boolean {
  if (typeof input !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && input.length <= 254;
}

/// Validates password strength — min 6 chars.
export function isValidPassword(input: unknown): boolean {
  if (typeof input !== "string") return false;
  return input.length >= 6 && input.length <= 128;
}

/// Clamps a number to a safe range.
export function clampNumber(input: unknown, min: number, max: number, fallback: number): number {
  const n = Number(input);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/// Sanitizes an object by applying sanitization to all string values.
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
