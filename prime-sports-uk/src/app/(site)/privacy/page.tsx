import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function Page() {
  return <LegalPage contentKey="legal.privacy" fallbackTitle="Privacy policy" />;
}
