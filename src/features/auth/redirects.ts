import { ADMIN_HOME_PATH, ADMIN_PUBLIC_PATHS } from "./constants";

/**
 * Returns `value` only if it is a same-origin dashboard path, otherwise the dashboard home.
 * Prevents open redirects through the `next` parameter (e.g. `//evil.com`, `/admin/../x`,
 * `https://…`, backslashes, encoded characters, or the auth pages themselves).
 */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 200) return ADMIN_HOME_PATH;
  const [path, query = ""] = value.split("?", 2);
  // Segments of lowercase letters, digits and hyphens only: no "//", "..", "\", "%" or trailing "/".
  if (!/^\/admin(\/[a-z0-9-]+)*$/.test(path)) return ADMIN_HOME_PATH;
  if ((ADMIN_PUBLIC_PATHS as readonly string[]).includes(path)) return ADMIN_HOME_PATH;
  if (query && !/^[a-z0-9_\-=&]*$/i.test(query)) return path;
  return query ? `${path}?${query}` : path;
}

export function isAdminPublicPath(pathname: string): boolean {
  return (ADMIN_PUBLIC_PATHS as readonly string[]).includes(pathname);
}
