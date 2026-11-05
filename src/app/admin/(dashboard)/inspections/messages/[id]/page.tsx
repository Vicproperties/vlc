import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Mail, Phone } from "lucide-react";
import { MessageControls } from "@/components/admin/enquiry-controls";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { getMessage } from "@/features/enquiries/admin";
import { requestReference } from "@/features/enquiries/schemas";
import { parsePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Message" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default function MessagePage({ params }: PageProps<"/admin/inspections/messages/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Message params={params} />
    </Suspense>
  );
}

async function Message({ params }: { params: PageProps<"/admin/inspections/messages/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = await requireAdmin();
  if (!can(admin, "enquiries", "view")) return <NoAccess section="contact messages" />;

  const message = await getMessage(id);
  if (!message) notFound();

  // Opening a message marks it as read (for admins who may edit messages).
  const canEdit = can(admin, "enquiries", "edit");
  if (!message.is_read && canEdit) {
    const supabase = await createClient();
    await supabase.from("contact_submissions").update({ is_read: true }).eq("id", id);
  }
  const phone = message.phone ? parsePhone(message.phone) : null;
  const reply = `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject ?? "Your message"}`)}`;

  return (
    <>
      <AdminPageHeader
        title={message.subject ?? "Message"}
        description={
          <>
            From {message.name} · {dateTime.format(new Date(message.created_at))} · reference{" "}
            <span className="font-mono">{requestReference(message.id)}</span> ·{" "}
            <Link href="/admin/inspections/messages" className="underline underline-offset-4">
              All messages
            </Link>
          </>
        }
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-6">
          <p className="max-w-3xl text-body whitespace-pre-line text-ink">{message.message}</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6 text-small">
            <li>
              <a href={reply} className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline">
                <Mail className="size-4 text-brand" aria-hidden="true" />
                Reply to {message.email}
              </a>
            </li>
            {phone?.ok && (
              <li>
                <a
                  href={`tel:${phone.e164}`}
                  className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline"
                >
                  <Phone className="size-4 text-brand" aria-hidden="true" />
                  {phone.international}
                </a>
              </li>
            )}
          </ul>
          <p className="text-caption text-stone">
            Consent to be contacted recorded {message.consent_at ? dateTime.format(new Date(message.consent_at)) : "—"}.
          </p>
        </div>
        <aside>
          <MessageControls
            id={message.id}
            isRead={message.is_read || canEdit}
            archived={message.archived_at !== null}
            canEdit={canEdit}
            canDelete={can(admin, "enquiries", "delete")}
          />
        </aside>
      </div>
    </>
  );
}
