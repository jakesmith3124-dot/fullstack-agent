import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { gbp, longDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TierForm } from "./TierForm";

export default async function MembershipsAdmin() {
  await requireOwner("/admin/memberships");
  const supabase = await createClient();
  const [{ data: products }, { data: members }, { data: flags }] = await Promise.all([
    supabase.from("membership_products").select("id, key, name, flag_key, membership_tiers(id, name, price_pence, confirmed, sort_order)").order("sort_order"),
    supabase.from("memberships").select("id, status, paused, cancel_at_period_end, current_period_end, last_payment_failed_at, profiles(email, full_name, phone), children(first_name, last_name), membership_tiers(name, price_pence, membership_products(name))").order("created_at", { ascending: false }),
    supabase.from("settings").select("value").eq("key", "flags").single(),
  ]);
  const f = (flags?.value ?? {}) as Record<string, boolean>;
  const rows = (members ?? []) as unknown as { id: string; status: string; paused: boolean; cancel_at_period_end: boolean; current_period_end: string | null; last_payment_failed_at: string | null; profiles: { email: string; full_name: string | null; phone: string | null }; children: { first_name: string; last_name: string } | null; membership_tiers: { name: string; price_pence: number; membership_products: { name: string } } }[];
  return (
    <>
      <h1 className="admin-title">Memberships</h1>
      <p className="muted">Monthly memberships stay hidden until switched on in <Link href="/admin/settings">Settings</Link>, and each tier only shows once its price is confirmed.</p>
      {(products ?? []).map((p) => (
        <div className="card" key={p.id}>
          <div className="row"><h2>{p.name}</h2><span className={`tag ${f[p.flag_key] ? "ok" : "ph"}`}>{f[p.flag_key] ? "On sale" : "Switched off"}</span></div>
          {((p.membership_tiers ?? []) as { id: string; name: string; price_pence: number; confirmed: boolean; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order).map((t) => <TierForm key={t.id} tier={t} />)}
        </div>
      ))}
      <div className="card table-wrap">
        <h2>Members ({rows.filter((r) => r.status !== "cancelled").length} active)</h2>
        <table>
          <thead><tr><th>Player</th><th>Parent</th><th>Membership</th><th>Monthly</th><th>Next payment</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.children ? `${m.children.first_name} ${m.children.last_name}` : "—"}</td>
                <td>{m.profiles.full_name || m.profiles.email}<br /><span className="muted">{m.profiles.phone}</span></td>
                <td>{m.membership_tiers.membership_products.name}<br /><span className="muted">{m.membership_tiers.name}</span></td>
                <td>{gbp(m.membership_tiers.price_pence)}</td>
                <td>{m.current_period_end && !m.paused && m.status !== "cancelled" ? longDate(m.current_period_end.slice(0, 10)) : "—"}</td>
                <td>{m.last_payment_failed_at && <span className="tag med">Payment failed</span>} {m.paused ? "Paused" : m.cancel_at_period_end ? "Cancelling" : m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted">No members yet.</p>}
      </div>
    </>
  );
}
