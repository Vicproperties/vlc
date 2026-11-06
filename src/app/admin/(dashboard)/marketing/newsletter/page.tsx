import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Mail } from "lucide-react";
import { DeleteSubscriber } from "@/components/admin/marketing-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Newsletter subscribers" };

const STATUSES = [
  { key: "active", label: "Confirmed" },
  { key: "pending", label: "Waiting for confirmation" },
  { key: "unsubscribed", label: "Unsubscribed" },
] as const;

export default function NewsletterPage({ searchParams }: PageProps<"/admin/marketing/newsletter">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Subscribers searchParams={searchParams} />
    </Suspense>
  );
}

async function Subscribers({
  searchParams,
}: {
  searchParams: PageProps<"/admin/marketing/newsletter">["searchParams"];
}) {
  const admin = await requireAdmin();
  if (!can(admin, "newsletter", "view")) return <NoAccess section="newsletter subscribers" />;
  const params = await searchParams;
  const status = STATUSES.find((s) => s.key === params.status)?.key ?? "active";

  const supabase = await createClient();
  const [list, ...counts] = await Promise.all([
    supabase
      .from("newsletter_subscribers")
      .select("id, email, status, subscribed_at, confirmed_at, unsubscribed_at")
      .eq("status", status)
      .order("subscribed_at", { ascending: false })
      .limit(500),
    ...STATUSES.map((s) =>
      supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", s.key),
    ),
  ]);
  if (list.error) throw new Error("Unable to load subscribers.");
  const canDelete = can(admin, "newsletter", "delete");

  return (
    <>
      <AdminPageHeader
        title="Newsletter subscribers"
        description="People who signed up in the website footer. Only confirmed addresses (they clicked the emailed link) should receive newsletters."
        actions={
          <a href="/admin/marketing/newsletter/export" className={buttonClasses("secondary", "md")}>
            Download confirmed (CSV)
          </a>
        }
      />
      <nav aria-label="Subscriber status" className="flex flex-wrap gap-2">
        {STATUSES.map((s, i) => (
          <Link
            key={s.key}
            href={`/admin/marketing/newsletter?status=${s.key}`}
            aria-current={s.key === status ? "page" : undefined}
            className={cn(
              "border px-3 py-1.5 text-small",
              s.key === status ? "border-brand bg-brand-tint text-ink" : "border-line text-stone hover:text-ink",
            )}
          >
            {s.label} ({counts[i].count ?? 0})
          </Link>
        ))}
      </nav>
      {list.data.length === 0 ? (
        <EmptyState icon={Mail} title="No subscribers here yet" description="Sign-ups appear here as they arrive." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Signed up</TH>
              <TH>Status</TH>
              {canDelete && <TH>Action</TH>}
            </TR>
          </THead>
          <TBody>
            {list.data.map((s) => (
              <TR key={s.id}>
                <TD className="break-all">{s.email}</TD>
                <TD>{formatDate(s.subscribed_at)}</TD>
                <TD>
                  {s.status === "active" ? (
                    <StatusText tone="success">Confirmed {s.confirmed_at ? formatDate(s.confirmed_at) : ""}</StatusText>
                  ) : s.status === "pending" ? (
                    <StatusText tone="accent">Waiting</StatusText>
                  ) : (
                    <StatusText tone="neutral">
                      Unsubscribed {s.unsubscribed_at ? formatDate(s.unsubscribed_at) : ""}
                    </StatusText>
                  )}
                </TD>
                {canDelete && (
                  <TD>
                    <DeleteSubscriber id={s.id} email={s.email} />
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
