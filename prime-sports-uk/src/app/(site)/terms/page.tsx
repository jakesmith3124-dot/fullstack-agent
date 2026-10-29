import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Terms and conditions", alternates: { canonical: "/terms" } };

export default function Page() {
  return <LegalPage contentKey="legal.terms" fallbackTitle="Terms and conditions" />;
}
