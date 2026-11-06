import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Activity logs" };

const PAGE_SIZE = 50;

/** Sections for the filter: the first part of each logged action ("blog.deleted" -> blog). */
const AREAS = [
  { key: "property", label: "Properties" },
  { key: "estate", label: "Estates" },
  { key: "inspection", label: "Inspections" },
  { key: "enquiry", label: "Contact messages" },
  { key: "blog", label: "Blog" },
  { key: "content", label: "Website content" },
  { key: "marketing", label: "Marketing" },
  { key: "newsletter", label: "Newsletter" },
  { key: "settings", label: "Settings" },
  { key: "cookies", label: "Cookies" },
  { key: "admin", label: "Administrators" },
  { key: "customer", label: "Customers" },
] as const;

/** Readable description of an action code; unknown codes are shown as they are. */
function describe(action: string): string {
  const known: Record<string, string> = {
    "admin.login": "Signed in to the dashboard",
    "admin.password_reset": "Reset their dashboard password",
    "admin.invited": "Invited an administrator",
    "admin.updated": "Changed an administrator's role or access",
    "admin.deactivated": "Removed an administrator's access",
    "admin.reactivated": "Restored an administrator's access",
    "admin.invite_resent": "Sent a password setup link",
    "property.updated": "Updated a property",
    "property.deleted": "Deleted a property",
    "property.photo_added": "Added a property photo",
    "property.photo_removed": "Removed a property photo",
    "property.import_completed": "Imported properties from a spreadsheet",
    "property.duplicate_cleared": "Cleared a duplicate warning",
    "building_type.created": "Added a building type",
    "estate.created": "Added an estate",
    "estate.updated": "Updated an estate",
    "estate.deleted": "Deleted an estate",
    "inspection.status_changed": "Changed an inspection request status",
    "inspection.deleted": "Deleted an inspection request",
    "enquiry.deleted": "Deleted a contact message",
    "blog.deleted": "Deleted a blog article",
    "content.section_saved": "Edited a website page section",
    "content.legal_page_saved": "Edited a legal page",
    "settings.updated": "Changed website settings",
    "settings.logo_updated": "Uploaded a new logo",
    "settings.logo_removed": "Removed the logo",
    "settings.favicon_updated": "Uploaded a new browser icon",
    "settings.favicon_removed": "Removed the browser icon",
    "blog.comment_deleted": "Deleted a blog comment",
    "cookies.settings_updated": "Changed cookie settings",
    "marketing.banner_created": "Added a top banner",
    "marketing.banner_updated": "Edited a top banner",
    "marketing.banner_deleted": "Deleted a top banner",
    "marketing.announcement_created": "Added an announcement",
    "marketing.announcement_updated": "Edited an announcement",
    "marketing.announcement_deleted": "Deleted an announcement",
    "marketing.promotion_on": "Started a property promotion",
    "marketing.promotion_off": "Ended a property promotion",
    "newsletter.exported": "Downloaded the subscriber list",
    "newsletter.subscriber_deleted": "Deleted a newsletter subscriber",
    "customer.account_deleted": "Deleted their customer account",
  };
  if (known[action]) return known[action];
  const content = /^content\.(core_values|why_choose_us_items|faqs|team_member)_(created|updated|deleted)$/.exec(
    action,
  );
  if (content) {
    const what = {
      core_values: "a core value",
      why_choose_us_items: "a Why choose us item",
      faqs: "an FAQ",
      team_member: "a team member",
    }[content[1]];
    return `${{ created: "Added", updated: "Edited", deleted: "Deleted" }[content[2]]} ${what}`;
  }
  return action;
}

const when = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ActivityLog searchParams={searchParams} />
    </Suspense>
  );
}

async function ActivityLog({ searchParams }: { searchParams: PageProps<"/admin/activity">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "activity_logs", "view")) return <NoAccess section="activity logs" />;
  const params = await searchParams;
  const area = AREAS.find((a) => a.key === params.area)?.key ?? null;
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(params.page ?? "1"), 10) || 1));

  const supabase = await createClient();
  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, actor_type, action, entity_type, entity_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (area) query = query.like("action", `${area}.%`);
  const { data, count, error } = await query;
  if (error) throw new Error("Unable to load the activity log.");

  // Names of the people involved (read server-side: only super admins can list administrators).
  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: admins } = await createServiceClient().from("admin_users").select("id, full_name").in("id", actorIds);
    for (const a of admins ?? []) names.set(a.id, a.full_name);
  }
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number, a: string | null = area) => {
    const q = new URLSearchParams();
    if (a) q.set("area", a);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/activity?${s}` : "/admin/activity";
  };

  return (
    <>
      <AdminPageHeader
        title="Activity logs"
        description="Who did what in the dashboard, newest first. Entries cannot be edited or deleted, and are kept for 2 years."
      />
      <nav aria-label="Filter by area" className="flex flex-wrap gap-2">
        {[{ key: null, label: "Everything" } as const, ...AREAS].map((a) => (
          <Link
            key={a.key ?? "all"}
            href={href(1, a.key)}
            aria-current={a.key === area ? "page" : undefined}
            className={cn(
              "border px-3 py-1.5 text-small",
              a.key === area ? "border-brand bg-brand-tint text-ink" : "border-line text-stone hover:text-ink",
            )}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      {data.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing recorded here yet"
          description="Changes made in the dashboard appear here."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>What</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{when.format(new Date(r.created_at))}</TD>
                <TD>
                  {r.actor_id && names.get(r.actor_id)
                    ? names.get(r.actor_id)
                    : r.actor_type === "customer"
                      ? "A customer"
                      : r.actor_type === "system"
                        ? "System"
                        : "Removed account"}
                </TD>
                <TD>{describe(r.action)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={(p) => href(p)} />}
    </>
  );
}
