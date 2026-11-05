import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { DeleteInspection, InspectionNotesForm, InspectionStatusForm } from "@/components/admin/enquiry-controls";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton, StatusText } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { getInspection, INSPECTION_STATUS_LABELS, STATUS_TONES } from "@/features/enquiries/admin";
import { PREFERRED_TIME_LABELS, requestReference } from "@/features/enquiries/schemas";
import { PURPOSE_LABELS } from "@/features/properties/options";
import { formatDate, formatNaira } from "@/lib/format";
import { parsePhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Inspection request" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default function InspectionPage({ params }: PageProps<"/admin/inspections/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Inspection params={params} />
    </Suspense>
  );
}

async function Inspection({ params }: { params: PageProps<"/admin/inspections/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = await requireAdmin();
  if (!can(admin, "inspections", "view")) return <NoAccess section="inspection requests" />;

  const request = await getInspection(id);
  if (!request) notFound();

  const snapshot = request.property_snapshot as {
    title?: string;
    path?: string;
    purpose?: keyof typeof PURPOSE_LABELS;
    price?: number;
    location?: string;
  };
  const phone = parsePhone(request.phone);
  const whatsapp = `https://wa.me/${request.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello ${request.full_name.split(" ")[0]}, thank you for your inspection request (${requestReference(request.id)}) for “${snapshot.title ?? "the property"}”.`,
  )}`;
  const canEdit = can(admin, "inspections", "edit");

  return (
    <>
      <AdminPageHeader
        title={request.full_name}
        description={
          <>
            Reference <span className="font-mono">{requestReference(request.id)}</span> · received{" "}
            {dateTime.format(new Date(request.created_at))} ·{" "}
            <Link href="/admin/inspections" className="underline underline-offset-4">
              All requests
            </Link>
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <h2 className="text-body font-semibold text-ink">Contact</h2>
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-small">
              <li>
                <a
                  href={`tel:${request.phone}`}
                  className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline"
                >
                  <Phone className="size-4 text-brand" aria-hidden="true" />
                  {phone.ok ? phone.international : request.phone}
                </a>
              </li>
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline"
                >
                  <MessageCircle className="size-4 text-brand" aria-hidden="true" />
                  WhatsApp
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
              {request.email && (
                <li>
                  <a
                    href={`mailto:${request.email}`}
                    className="inline-flex items-center gap-2 text-ink underline-offset-4 hover:underline"
                  >
                    <Mail className="size-4 text-brand" aria-hidden="true" />
                    {request.email}
                  </a>
                </li>
              )}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-body font-semibold text-ink">Request</h2>
            <dl className="grid gap-x-10 border-t border-line sm:grid-cols-2">
              {[
                ["Preferred date", request.preferred_date ? formatDate(request.preferred_date) : "Any day"],
                [
                  "Preferred time",
                  request.preferred_time
                    ? (PREFERRED_TIME_LABELS[request.preferred_time as keyof typeof PREFERRED_TIME_LABELS] ??
                      request.preferred_time)
                    : "Any time",
                ],
                [
                  "Consent to contact",
                  request.consent_at ? dateTime.format(new Date(request.consent_at)) : "Not recorded",
                ],
                ["Customer account", request.customer_id ? "Linked" : "Guest"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 border-b border-line py-3">
                  <dt className="text-small text-stone">{label}</dt>
                  <dd className="text-right text-small text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {request.message && (
              <blockquote className="border-l-2 border-brand-light pl-4 text-small whitespace-pre-line text-ink">
                {request.message}
              </blockquote>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-body font-semibold text-ink">Property (at the time of the request)</h2>
            <p className="text-small text-ink">
              {request.property_id && snapshot.path ? (
                <Link
                  href={`/admin/properties/${request.property_id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {snapshot.title}
                </Link>
              ) : (
                <span className="font-medium">{snapshot.title ?? "Property removed"}</span>
              )}
            </p>
            <p className="text-small text-stone">
              {[
                snapshot.purpose && PURPOSE_LABELS[snapshot.purpose],
                snapshot.location,
                snapshot.price && formatNaira(snapshot.price),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-body font-semibold text-ink">History</h2>
            <ol className="flex flex-col border-l border-line">
              {request.history.map((entry) => (
                <li key={entry.id} className="relative flex flex-col gap-1 py-3 pl-6">
                  <span aria-hidden="true" className="absolute top-[1.15rem] -left-[4px] size-2 bg-brand" />
                  <p className="text-small text-ink">
                    {entry.from_status
                      ? `${INSPECTION_STATUS_LABELS[entry.from_status]} → ${INSPECTION_STATUS_LABELS[entry.to_status]}`
                      : "Request received"}
                    {entry.staffName && <span className="text-stone"> · {entry.staffName}</span>}
                  </p>
                  <p className="text-caption text-stone">{dateTime.format(new Date(entry.created_at))}</p>
                  {entry.note && <p className="text-small whitespace-pre-line text-ink">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-small text-stone">Current status</p>
            <StatusText tone={STATUS_TONES[request.status]}>{INSPECTION_STATUS_LABELS[request.status]}</StatusText>
          </div>
          {canEdit && (
            <>
              <InspectionStatusForm id={request.id} status={request.status} />
              <InspectionNotesForm id={request.id} notes={request.admin_notes ?? ""} />
            </>
          )}
          {can(admin, "inspections", "delete") && <DeleteInspection id={request.id} />}
        </aside>
      </div>
    </>
  );
}
