import { NextResponse } from "next/server";
import { CampReminderEmail } from "@/emails/templates";
import { cronAuthorised } from "@/lib/cron";
import { sendEmail } from "@/lib/email";
import { longDate, timeRange, todayLondon } from "@/lib/format";
import { addDays } from "@/lib/pricing";
import { notifyParent } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

// Runs every afternoon: reminder email (and app notification) the day before a booking's first camp day.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = createAdminClient();
  const tomorrow = addDays(todayLondon(), 1);
  const { data } = await db
    .from("bookings")
    .select("id, parent_id, parent_name, parent_email, camps(school, address, area, postcode, start_time, end_time, what_to_bring), booking_places(camp_days(date), children(first_name))")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null);
  let sent = 0;
  for (const b of data ?? []) {
    const places = (b.booking_places ?? []) as unknown as { camp_days: { date: string }; children: { first_name: string } }[];
    const first = places.map((p) => p.camp_days.date).sort()[0];
    if (first !== tomorrow) continue;
    const camp = b.camps as unknown as { school: string; address: string | null; area: string; postcode: string | null; start_time: string; end_time: string; what_to_bring: string | null };
    const children = [...new Set(places.map((p) => p.children.first_name))];
    await sendEmail({
      to: b.parent_email,
      subject: `See you tomorrow at ${camp.school}`,
      react: CampReminderEmail({
        parentName: b.parent_name, school: camp.school, address: [camp.address, camp.area, camp.postcode].filter(Boolean).join(", ") || null,
        date: longDate(first), times: timeRange(camp.start_time, camp.end_time), children, whatToBring: camp.what_to_bring,
      }),
    });
    await notifyParent(b.parent_id, "pickup_reminder", { title: "Camp tomorrow", body: `${children.join(" and ")} ${children.length > 1 ? "are" : "is"} booked in at ${camp.school} tomorrow, ${timeRange(camp.start_time, camp.end_time)}.`, url: "/app" }, { emailFallback: false });
    await db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
    sent++;
  }
  return NextResponse.json({ sent });
}
