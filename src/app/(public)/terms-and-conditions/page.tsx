import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  alternates: { canonical: "/terms-and-conditions" },
};

export default function Page() {
  return <LegalPage slug="terms-and-conditions" fallbackTitle="Terms and Conditions" />;
}
