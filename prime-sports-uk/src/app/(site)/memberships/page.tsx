import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getFlags } from "@/lib/data";
import { gbp } from "@/lib/format";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { MembershipForm } from "./MembershipForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Memberships", description: "Monthly memberships from Prime Sports UK. Cancel any time before your next payment." };

export default async function MembershipsPage() {
  const [flags, viewer] = await Promise.all([getFlags(), getViewer()]);
  const { data } = await createPublicClient().from("membership_products").select("id, key, name, tag, ages, blurb, perks, flag_key, membership_tiers(id, name, price_pence, sort_order)").order("sort_order");
  const products = (data ?? []).filter((p) => flags[p.flag_key as keyof typeof flags]).map((p) => ({ ...p, tiers: ((p.membership_tiers ?? []) as { id: string; name: string; price_pence: number; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order) })).filter((p) => p.tiers.length);
  let children: { id: string; first_name: string }[] = [];
  if (viewer) {
    const { data: kids } = await (await createClient()).from("children").select("id, first_name").eq("parent_id", viewer.id).order("first_name");
    children = kids ?? [];
  }
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Memberships</div>
          <h1>Monthly memberships</h1>
          <p>Monthly plans that renew automatically. Pause or cancel any time before your next payment.</p>
        </div>
      </div>
      <section>
        <div className="wrap" style={{ display: "grid", gap: "1.2rem" }}>
          {!products.length && (
            <div className="card">
              <h2 className="h3-size">Memberships aren&apos;t open yet</h2>
              <p>G.O.A.T Football Academy is coming in 2027. <Link href="/goat#waiting-list">Join the waiting list</Link> to hear first.</p>
            </div>
          )}
          {products.map((p) => (
            <div className="card" key={p.id}>
              <div className="chips"><span className="tag gold">{p.tag}</span><span className="tag">Ages {p.ages}</span></div>
              <h2>{p.name}</h2>
              <p className="muted">{p.blurb}</p>
              <ul>{(p.perks as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
              {viewer ? (
                children.length ? (
                  <MembershipForm tiers={p.tiers.map((t) => ({ id: t.id, label: `${t.name} · ${gbp(t.price_pence)}/month` }))} kids={children} />
                ) : (
                  <p>First <Link href="/account/children/new">add your child&apos;s details</Link>, then come back to join.</p>
                )
              ) : (
                <Link className="btn" href="/login?next=/memberships">Sign in to join</Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
