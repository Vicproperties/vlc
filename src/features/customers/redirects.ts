/**
 * Where a customer may be sent after signing in: same-site paths only, never the dashboard.
 * Prevents open redirects through the `next` parameter.
 */
export const CUSTOMER_HOME = "/account";

export function safeCustomerPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return CUSTOMER_HOME;
  if (!/^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(value)) return CUSTOMER_HOME;
  if (/^\/admin(\/|$|\?)/.test(value) || value.startsWith("/auth/")) return CUSTOMER_HOME;
  if (value.includes("..") || value.includes("\\")) return CUSTOMER_HOME;
  return value;
}
