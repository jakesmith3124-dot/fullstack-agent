import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Cookie policy", alternates: { canonical: "/cookies" } };

export default function Page() {
  return <LegalPage contentKey="legal.cookies" fallbackTitle="Cookie policy" />;
}
