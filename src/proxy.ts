import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { isAdminPublicPath } from "@/features/auth/redirects";

/**
 * Runs before /admin requests:
 *   1. Refreshes the Supabase session cookies (Server Components cannot write cookies).
 *   2. Optimistic redirect: no signed-in user -> /admin/login. This is a convenience only;
 *      authorization is enforced by requireAdmin() on the server and by RLS in the database.
 * Also covers the customer account area (/account), which redirects to its own sign-in page.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
      },
    },
  });

  // Validates the JWT (and refreshes it when expired). Do not run code between client
  // creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsLogin = isAdminArea ? !isAdminPublicPath(pathname) : pathname !== "/account/login";
  if (!signedIn && needsLogin) {
    const login = request.nextUrl.clone();
    login.pathname = isAdminArea ? "/admin/login" : "/account/login";
    login.search = "";
    if (pathname !== "/admin" && pathname !== "/account") {
      login.searchParams.set("next", `${pathname}${search}`.slice(0, 200));
    }
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  // Dashboard and account responses are per-user: never store them in shared caches.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/account", "/account/:path*"],
};
