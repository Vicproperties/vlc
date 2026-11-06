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

type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, name: string): string {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Where to go after signing in, and the property to save then (from the page address). */
export function carriedParams(params: SearchParams): { next: string; favourite: string | null } {
  const favourite = firstParam(params, "favourite");
  return {
    next: safeCustomerPath(firstParam(params, "next") || CUSTOMER_HOME),
    favourite: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(favourite) ? favourite : null,
  };
}

/** Query string that keeps `next` and `favourite` when moving between sign-in and register. */
export function carriedQuery({ next, favourite }: { next: string; favourite: string | null }): string {
  const query = new URLSearchParams();
  if (next !== CUSTOMER_HOME) query.set("next", next);
  if (favourite) query.set("favourite", favourite);
  const value = query.toString();
  return value ? `?${value}` : "";
}
