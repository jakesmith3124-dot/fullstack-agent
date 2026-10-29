import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Safeguarding policy", alternates: { canonical: "/safeguarding-policy" } };

export default function Page() {
  return <LegalPage contentKey="legal.safeguarding" fallbackTitle="Safeguarding policy" />;
}
