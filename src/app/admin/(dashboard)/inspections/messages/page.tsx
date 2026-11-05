import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { EnquiryTabs } from "@/components/admin/enquiry-tabs";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { ADMIN_PAGE_SIZE, listMessages } from "@/features/enquiries/admin";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Contact messages" };

export default function MessagesPage({ searchParams }: PageProps<"/admin/inspections/messages">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Messages searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Messages({ searchParams }: { searchParams: PageProps<"/admin/inspections/messages">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "enquiries", "view")) return <NoAccess section="contact messages" />;
  const params = await searchParams;
  const box = one(params.box) === "archived" ? "archived" : "inbox";
  const q = one(params.q).slice(0, 60);
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(params.page), 10) || 1));
  const { rows, total } = await listMessages({ box, q, page });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (target: number) => {
    const query = new URLSearchParams();
    if (box === "archived") query.set("box", "archived");
    if (q) query.set("q", q);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/admin/inspections/messages?${text}` : "/admin/inspections/messages";
  };

  return (
    <>
      <AdminPageHeader
        title="Inspections & enquiries"
        description={`${total} message${total === 1 ? "" : "s"} in ${box === "archived" ? "the archive" : "the inbox"}.`}
      />
      <EnquiryTabs current="messages" canInspections={can(admin, "inspections", "view")} canMessages />
      {one(params.deleted) === "1" && <Notice tone="success">The message was deleted.</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-6 text-small">
          <Link
            href="/admin/inspections/messages"
            className={cn(
              "underline-offset-4",
              box === "inbox" ? "font-medium text-ink underline" : "text-stone hover:underline",
            )}
          >
            Inbox
          </Link>
          <Link
            href="/admin/inspections/messages?box=archived"
            className={cn(
              "underline-offset-4",
              box === "archived" ? "font-medium text-ink underline" : "text-stone hover:underline",
            )}
          >
            Archived
          </Link>
        </div>
        <form method="get" role="search" className="flex gap-3">
          {box === "archived" && <input type="hidden" name="box" value="archived" />}
          <label htmlFor="q" className="sr-only">
            Search messages
          </label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or subject" className="w-64" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={q ? "No messages match" : "No messages"}
          description="Messages from the contact page appear here."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Received</TH>
              <TH>From</TH>
              <TH>Message</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap text-stone">{formatDate(row.created_at)}</TD>
                <TD>
                  <Link
                    href={`/admin/inspections/messages/${row.id}`}
                    className={cn("text-ink underline-offset-4 hover:underline", !row.is_read && "font-semibold")}
                  >
                    {row.name}
                  </Link>
                  {!row.is_read && <span className="sr-only"> (unread)</span>}
                  <span className="block text-caption text-stone">{row.email}</span>
                </TD>
                <TD className="max-w-md">
                  {row.subject && (
                    <span className={cn("block text-ink", !row.is_read && "font-semibold")}>{row.subject}</span>
                  )}
                  <span className="line-clamp-1 text-small text-stone">{row.message}</span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} hrefFor={href} />
    </>
  );
}
