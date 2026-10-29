import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getCampBySlug, getFlags, getInstalmentRules, getSiblingDiscount, isBookable } from "@/lib/data";
import { fakePaymentsEnabled, STRIPE_PUBLISHABLE_KEY } from "@/lib/env";
import { todayLondon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow, type SavedChild, type SavedParent } from "./BookingFlow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book a holiday camp", robots: { index: false } };

export default async function BookPage({ params }: PageProps<"/book/[campSlug]">) {
  const { campSlug } = await params;
  const [camp, flags, sibling, rules, viewer] = await Promise.all([
    getCampBySlug(campSlug), getFlags(), getSiblingDiscount(), getInstalmentRules(), getViewer(),
  ]);
  if (!camp) notFound();
  const today = todayLondon();
  const days = camp.days.filter((d) => d.date >= today);

  if (!isBookable(camp, flags) || !days.length) {
    return (
      <section className="center">
        <div className="wrap" style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
          <h1>Bookings aren&apos;t open</h1>
          <p className="muted">Bookings for {camp.school} aren&apos;t open right now.</p>
          <Link className="btn" href="/camps">See other camps</Link>
        </div>
      </section>
    );
  }

  let savedChildren: SavedChild[] = [];
  let savedParent: SavedParent | null = null;
  if (viewer) {
    const supabase = await createClient();
    const [{ data: kids }, { data: profile }] = await Promise.all([
      supabase.from("children").select("id, first_name, last_name, dob, school, medical, allergies, send, photo_consent, collectors").eq("parent_id", viewer.id).order("first_name"),
      supabase.from("profiles").select("full_name, email, phone, emergency_name, emergency_phone, emergency_relationship").eq("id", viewer.id).single(),
    ]);
    savedChildren = (kids ?? []) as SavedChild[];
    savedParent = profile as SavedParent | null;
  }

  return (
    <BookingFlow
      camp={{
        slug: camp.slug, school: camp.school, area: camp.area, age_min: camp.age_min, age_max: camp.age_max,
        start_time: camp.start_time, end_time: camp.end_time, price_per_day_pence: camp.price_per_day_pence,
        full_week_price_pence: camp.full_week_price_pence, logo_path: camp.logo_path, photo_path: camp.photo_path,
        total_days: camp.days.length,
      }}
      days={days}
      siblingPct={sibling.confirmed ? sibling.pct : 0}
      rules={rules}
      today={today}
      signedIn={!!viewer}
      savedChildren={savedChildren}
      savedParent={savedParent}
      payments={STRIPE_PUBLISHABLE_KEY ? { mode: "stripe", key: STRIPE_PUBLISHABLE_KEY } : fakePaymentsEnabled() ? { mode: "fake" } : { mode: "off" }}
    />
  );
}
