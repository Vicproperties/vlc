import { LayoutDashboard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/states";

export default function AdminOverviewPage() {
  return (
    <>
      <AdminPageHeader title="Overview" description="Operational summary of the website." />
      <EmptyState
        icon={LayoutDashboard}
        title="No data connected yet"
        description="Property, inspection, enquiry and subscriber figures appear here once the database is connected in Stage 3 and authentication in Stage 4."
      />
    </>
  );
}
