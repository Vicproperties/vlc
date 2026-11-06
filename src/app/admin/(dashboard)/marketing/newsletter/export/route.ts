import { requireAdminPermission } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

/** Confirmed subscribers as CSV, for use in an email tool. Each download is logged. */
export async function GET() {
  await requireAdminPermission("newsletter", "view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("email, confirmed_at, source")
    .eq("status", "active")
    .order("confirmed_at");
  if (error) return new Response("Unable to export.", { status: 500 });
  await supabase.rpc("log_activity", {
    p_action: "newsletter.exported",
    p_entity_type: "newsletter_subscriber",
    p_metadata: { rows: data.length },
  });

  // Prefix values a spreadsheet would run as a formula; quote everything.
  const cell = (value: string | null) => {
    const v = value ?? "";
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [
    "email,confirmed_at,source",
    ...data.map((r) => [r.email, r.confirmed_at, r.source].map(cell).join(",")),
  ];
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="newsletter-subscribers.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
