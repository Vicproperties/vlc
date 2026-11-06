import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daily clean-up (Vercel Cron, see vercel.json): raw visit records older than 90 days and
 * anonymous cookie choices older than 1 year are deleted. Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const service = createServiceClient();
  const day = 86_400_000;
  const visits = new Date(Date.now() - 90 * day).toISOString();
  const consents = new Date(Date.now() - 365 * day).toISOString();
  // Events cascade with their session; old events of still-active sessions go too.
  const results = await Promise.all([
    service.from("analytics_events").delete().lt("created_at", visits),
    service.from("analytics_sessions").delete().lt("last_seen_at", visits),
    service.from("cookie_consents").delete().lt("created_at", consents),
  ]);
  const failed = results.filter((r) => r.error).length;
  return Response.json({ ok: failed === 0 }, { status: failed ? 500 : 200 });
}
