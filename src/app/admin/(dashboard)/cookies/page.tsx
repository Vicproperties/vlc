import type { Metadata } from "next";
import { Suspense } from "react";
import { CookieSettingsForm } from "@/components/admin/cookie-settings-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { DEFAULT_ANALYTICS_DESCRIPTION, DEFAULT_NOTICE } from "@/features/cookies/consent";
import { formatNumber, isoDaysAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cookie management" };

export default function CookiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Cookies />
    </Suspense>
  );
}

async function Cookies() {
  const admin = await requireAdmin();
  if (!can(admin, "cookies", "view")) return <NoAccess section="cookie management" />;
  const supabase = await createClient();
  const since = isoDaysAgo(30);
  const [settings, accepted, declined] = await Promise.all([
    supabase
      .from("cookie_settings")
      .select("notice_text, analytics_description, policy_version, enable_first_party_analytics")
      .eq("id", 1)
      .single(),
    supabase
      .from("cookie_consents")
      .select("id", { count: "exact", head: true })
      .eq("analytics", true)
      .gte("created_at", since),
    supabase
      .from("cookie_consents")
      .select("id", { count: "exact", head: true })
      .eq("analytics", false)
      .gte("created_at", since),
  ]);
  if (settings.error) throw new Error("Unable to load cookie settings.");
  const total = (accepted.count ?? 0) + (declined.count ?? 0);

  return (
    <>
      <AdminPageHeader
        title="Cookie management"
        description={`The notice visitors see and whether visit statistics are collected. Policy version ${settings.data.policy_version}.`}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-body font-semibold text-ink">Choices in the last 30 days</h2>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-3">
          <li className="flex flex-col gap-2 bg-paper p-5">
            <span className="text-small text-stone">Accepted statistics</span>
            <span className="font-serif text-h2 text-ink">{formatNumber(accepted.count ?? 0)}</span>
          </li>
          <li className="flex flex-col gap-2 bg-paper p-5">
            <span className="text-small text-stone">Essential only</span>
            <span className="font-serif text-h2 text-ink">{formatNumber(declined.count ?? 0)}</span>
          </li>
          <li className="flex flex-col gap-2 bg-paper p-5">
            <span className="text-small text-stone">Acceptance rate</span>
            <span className="font-serif text-h2 text-ink">
              {total ? `${Math.round(((accepted.count ?? 0) / total) * 100)}%` : "No data"}
            </span>
          </li>
        </ul>
        <p className="text-caption text-stone">Choices are recorded anonymously, without IP addresses.</p>
      </section>
      <Notice tone="info">
        Have the cookie text reviewed together with your privacy policy (Nigeria Data Protection Act 2023).
      </Notice>
      {can(admin, "cookies", "edit") ? (
        <CookieSettingsForm
          initial={{
            notice: settings.data.notice_text ?? "",
            analyticsDescription: settings.data.analytics_description ?? "",
            analyticsEnabled: settings.data.enable_first_party_analytics,
            defaults: { notice: DEFAULT_NOTICE, analytics: DEFAULT_ANALYTICS_DESCRIPTION },
          }}
        />
      ) : (
        <Notice tone="info">You can view these settings but not change them.</Notice>
      )}
    </>
  );
}
