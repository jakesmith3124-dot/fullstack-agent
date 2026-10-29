import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Download my data": everything we hold about this parent and their children, as JSON.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const supabase = await createClient();
  const [profile, children, bookings, memberships, signatures, register, late] = await Promise.all([
    supabase.from("profiles").select("email, full_name, phone, emergency_name, emergency_phone, emergency_relationship, notification_prefs, created_at").eq("id", viewer.id).single(),
    supabase.from("children").select("first_name, last_name, dob, school, medical, allergies, send, photo_consent, collectors, created_at").eq("parent_id", viewer.id),
    supabase.from("bookings").select("ref, status, plan, total_pence, amount_paid_pence, amount_refunded_pence, created_at, camps(school, area), booking_places(camp_days(date), children(first_name)), instalments(seq, due_date, amount_pence, status), payments(amount_pence, created_at, receipt_url)").eq("parent_id", viewer.id),
    supabase.from("memberships").select("status, created_at, current_period_end, membership_tiers(name, price_pence)").eq("parent_id", viewer.id),
    supabase.from("consent_signatures").select("form_key, form_version, signed_name, signed_on, signed_at").eq("parent_id", viewer.id),
    supabase.from("register_entries").select("signed_in_at, signed_out_at, collected_by, camp_days(date), children(first_name)"),
    supabase.from("late_notices").select("eta_minutes, created_at, acknowledged_at").eq("parent_id", viewer.id),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    profile: profile.data, children: children.data, bookings: bookings.data, memberships: memberships.data,
    consent_signatures: signatures.data, attendance: register.data, late_notices: late.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="prime-sports-uk-my-data.json"`, "Cache-Control": "no-store" },
  });
}
