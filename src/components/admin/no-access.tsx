import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

/** Shown when a signed-in admin lacks the permission for a section. */
export function NoAccess({ section }: { section: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="You do not have access to this section"
      description={`Ask a super administrator to give you access to ${section}.`}
    />
  );
}
