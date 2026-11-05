import Link from "next/link";
import { cn } from "@/lib/cn";

/** Switch between inspection requests and contact messages (shown only if both are allowed). */
export function EnquiryTabs({
  current,
  canInspections,
  canMessages,
}: {
  current: "inspections" | "messages";
  canInspections: boolean;
  canMessages: boolean;
}) {
  if (!(canInspections && canMessages)) return null;
  const tabs = [
    { key: "inspections", label: "Inspection requests", href: "/admin/inspections" },
    { key: "messages", label: "Contact messages", href: "/admin/inspections/messages" },
  ] as const;
  return (
    <nav aria-label="Enquiry type" className="flex gap-6 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-3 text-small",
            current === tab.key ? "border-brand font-medium text-ink" : "border-transparent text-stone hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
