import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountShell } from "@/components/public/account-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { getMyInspectionRequests } from "@/features/customers/queries";
import { INSPECTION_STATUS_LABELS, STATUS_TONES } from "@/features/enquiries/admin";
import { PREFERRED_TIME_LABELS } from "@/features/enquiries/schemas";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My inspection requests", robots: { index: false, follow: false } };

export default function InspectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="container-content py-16">
          <Skeleton className="h-64" />
        </div>
      }
    >
      <AccountShell current="/account/inspections" title="My inspection requests">
        {() => <RequestList />}
      </AccountShell>
    </Suspense>
  );
}

async function RequestList() {
  const requests = await getMyInspectionRequests();
  if (!requests.length)
    return (
      <EmptyState
        icon={CalendarDays}
        title="No inspection requests yet"
        description="Requests you send while signed in appear here with their status."
        action={
          <ButtonLink href="/properties" variant="secondary">
            Browse properties
          </ButtonLink>
        }
      />
    );
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-medium text-ink">
              {r.path ? (
                <Link href={r.path} className="underline-offset-4 hover:underline">
                  {r.title}
                </Link>
              ) : (
                r.title
              )}
            </p>
            {r.location && <p className="text-small text-stone">{r.location}</p>}
            <p className="text-small text-stone">
              Preferred: {r.preferredDate ? formatDate(r.preferredDate) : "any date"}
              {r.preferredTime &&
                `, ${PREFERRED_TIME_LABELS[r.preferredTime as keyof typeof PREFERRED_TIME_LABELS] ?? r.preferredTime}`}
            </p>
            <p className="text-caption text-stone">Sent {formatDate(r.createdAt)}</p>
          </div>
          <StatusText tone={STATUS_TONES[r.status]}>{INSPECTION_STATUS_LABELS[r.status]}</StatusText>
        </li>
      ))}
    </ul>
  );
}
