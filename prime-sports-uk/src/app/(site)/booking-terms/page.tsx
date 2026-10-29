import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Booking terms and cancellation policy", alternates: { canonical: "/booking-terms" } };

export default function Page() {
  return <LegalPage contentKey="legal.booking_terms" fallbackTitle="Booking terms and cancellation policy" />;
}
