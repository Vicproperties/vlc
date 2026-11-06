import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { type Period, PERIODS, type Ranked, analyticsSummary } from "@/features/analytics/summary";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Visitor analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

const dayLabel = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

async function Analytics({ searchParams }: { searchParams: PageProps<"/admin/analytics">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "analytics", "view")) return <NoAccess section="visitor analytics" />;
  const params = await searchParams;
  const days = (PERIODS.find((p) => String(p) === params.days) ?? 30) as Period;
  const s = await analyticsSummary(days);

  const tiles = [
    { label: "Visitors", value: s.visitors },
    { label: "Page views", value: s.pageViews },
    { label: "Property views", value: s.propertyViews },
    { label: "WhatsApp clicks", value: s.whatsappClicks },
    { label: "Phone clicks", value: s.phoneClicks },
    { label: "On the site now", value: s.activeNow },
  ];

  return (
    <>
      <AdminPageHeader
        title="Visitor analytics"
        description="Counts only visitors who accepted statistics in the cookie notice, so real traffic is higher. No personal details are stored."
      />
      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/analytics?days=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={cn(
              "border px-3 py-1.5 text-small",
              p === days ? "border-brand bg-brand-tint text-ink" : "border-line text-stone hover:text-ink",
            )}
          >
            Last {p} days
          </Link>
        ))}
      </nav>
      {s.truncated && (
        <Notice tone="info">Very high traffic: figures are based on the most recent 50,000 records.</Notice>
      )}
      <ul className="grid gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <li key={t.label} className="flex flex-col gap-2 bg-paper p-5">
            <span className="text-small text-stone">{t.label}</span>
            <span className="font-serif text-h2 text-ink">{formatNumber(t.value)}</span>
          </li>
        ))}
      </ul>
      {s.visitors === 0 && s.pageViews === 0 ? (
        <Notice tone="info">
          No visits recorded in this period yet. Visits appear once people accept statistics in the cookie notice.
        </Notice>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <RankedTable title="Most viewed pages" rows={s.pages} unit="Views" link />
          <RankedTable title="Most viewed properties" rows={s.properties} unit="Views" link />
          <RankedTable title="How visitors found the site" rows={s.sources} unit="Visitors" total={s.visitors} />
          <RankedTable title="Devices" rows={s.devices} unit="Visitors" total={s.visitors} />
          <RankedTable title="Countries" rows={s.countries} unit="Visitors" total={s.visitors} />
          <RankedTable title="Websites that sent visitors" rows={s.referrers} unit="Visitors" />
          <section className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-body font-semibold text-ink">Day by day</h2>
            <Table>
              <THead>
                <TR>
                  <TH>Day</TH>
                  <TH>Visitors</TH>
                  <TH>Page views</TH>
                </TR>
              </THead>
              <TBody>
                {[...s.daily].reverse().map((d) => (
                  <TR key={d.day}>
                    <TD>{dayLabel.format(new Date(`${d.day}T00:00:00Z`))}</TD>
                    <TD>{formatNumber(d.visitors)}</TD>
                    <TD>{formatNumber(d.pageViews)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>
        </div>
      )}
    </>
  );
}

function RankedTable({
  title,
  rows,
  unit,
  total,
  link,
}: {
  title: string;
  rows: Ranked[];
  unit: string;
  total?: number;
  link?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-small text-stone">Nothing recorded yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{title.startsWith("Most viewed p") ? "Page" : "Name"}</TH>
              <TH className="text-right">{unit}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={`${r.label}-${r.href ?? ""}`}>
                <TD className="break-all">
                  {link && r.href ? (
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {r.label}
                    </a>
                  ) : (
                    r.label
                  )}
                </TD>
                <TD className="text-right tabular-nums">
                  {formatNumber(r.value)}
                  {total ? <span className="text-stone"> ({Math.round((r.value / total) * 100)}%)</span> : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
