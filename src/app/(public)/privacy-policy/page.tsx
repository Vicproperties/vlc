import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy-policy" },
};

export default function Page() {
  return <LegalPage slug="privacy-policy" fallbackTitle="Privacy Policy" />;
}
