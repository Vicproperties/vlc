import type { Metadata } from "next";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { SOCIAL_NETWORKS } from "@/features/settings/networks";
import { parsePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Website settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const admin = await requireAdmin();
  if (!can(admin, "settings", "view")) return <NoAccess section="website settings" />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select(
      "company_name, tagline, phone_primary, phone_secondary, whatsapp_number, email_primary, address, map_embed_url, business_hours, social_links, default_seo_title, default_seo_description",
    )
    .eq("id", 1)
    .maybeSingle();

  // Stored phones are E.164 (+234…); show them in the readable international format.
  const phone = (value: string | null | undefined) => {
    if (!value) return "";
    const parsed = parsePhone(value);
    return parsed.ok ? parsed.international : value;
  };
  const social = (data?.social_links ?? {}) as Record<string, string>;
  const initial: Record<string, string> = {
    company_name: data?.company_name ?? "",
    tagline: data?.tagline ?? "",
    phone_primary: phone(data?.phone_primary),
    phone_secondary: phone(data?.phone_secondary),
    whatsapp_number: phone(data?.whatsapp_number),
    email_primary: data?.email_primary ?? "",
    address: data?.address ?? "",
    map_embed_url: data?.map_embed_url ?? "",
    business_hours: Array.isArray(data?.business_hours) ? (data.business_hours as string[]).join("\n") : "",
    default_seo_title: data?.default_seo_title ?? "",
    default_seo_description: data?.default_seo_description ?? "",
    ...Object.fromEntries(SOCIAL_NETWORKS.map((n) => [`social_${n.key}`, social[n.key] ?? ""])),
  };

  return (
    <>
      <AdminPageHeader title="Website settings" description="Company details used across the website." />
      {can(admin, "settings", "edit") ? (
        <SettingsForm initial={initial} />
      ) : (
        <Notice tone="info">You can view these settings but not change them.</Notice>
      )}
    </>
  );
}
