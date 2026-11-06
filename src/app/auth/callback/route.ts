import { NextResponse, type NextRequest } from "next/server";
import { safeCustomerPath } from "@/features/customers/redirects";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Google sign-in returns here. Exchanges the one-time code for a session (PKCE), then saves
 * the favourite the visitor clicked before signing in, then continues to a same-site page.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeCustomerPath(url.searchParams.get("next"));
  const favourite = url.searchParams.get("favourite") ?? "";
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (!code || code.length > 512) return back("/account/login?error=sign_in");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("/account/login?error=sign_in");

  const service = createServiceClient();
  const { data: staff } = await service.from("admin_users").select("id").eq("id", data.user.id).maybeSingle();
  if (staff) {
    // Staff accounts never become customer accounts (owner brief: separate authentication).
    await supabase.auth.signOut({ scope: "local" });
    return back("/account/login?error=staff");
  }

  // Profiles are created by a database trigger for Google sign-ups; make sure one exists for
  // accounts that signed up through Google before the trigger existed.
  await service.from("customer_profiles").upsert(
    {
      id: data.user.id,
      full_name: (data.user.user_metadata.full_name ?? data.user.user_metadata.name ?? null)?.slice(0, 120) ?? null,
      avatar_url: (data.user.user_metadata.avatar_url ?? null)?.slice(0, 1000) ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (UUID.test(favourite)) {
    // RLS: only for this customer and only for listed properties.
    await supabase
      .from("favourites")
      .upsert(
        { customer_id: data.user.id, property_id: favourite },
        { onConflict: "customer_id,property_id", ignoreDuplicates: true },
      );
  }
  return back(next);
}
