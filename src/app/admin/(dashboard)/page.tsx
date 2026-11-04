import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { requireAdmin } from "@/features/auth/admin-session";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const admin = await requireAdmin();
  const firstName = admin.fullName.split(/\s+/)[0];
  return (
    <>
      <AdminPageHeader title={`Welcome, ${firstName}`} description="Operational summary of the website." />
      <EmptyState
        icon={LayoutDashboard}
        title="Nothing to summarise yet"
        description="Property, inspection, enquiry and subscriber figures appear here as each section of the dashboard is built."
      />
    </>
  );
}
