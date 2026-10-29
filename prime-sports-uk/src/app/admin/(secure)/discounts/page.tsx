import { deleteDiscount } from "@/app/actions/admin-content";
import { requireOwner } from "@/lib/auth";
import { toLondonInput } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { DiscountForm } from "./DiscountForm";

export default async function DiscountsPage() {
  await requireOwner("/admin/discounts");
  const supabase = await createClient();
  const [{ data: codes }, { data: camps }] = await Promise.all([
    supabase.from("discount_codes").select("*").order("created_at"),
    supabase.from("camps").select("id, school, area").order("sort_order"),
  ]);
  return (
    <>
      <h1 className="admin-title">Discount codes</h1>
      <p className="muted">Codes are checked when parents pay. Percentage codes apply after the sibling discount.</p>
      {(codes ?? []).map((c) => (
        <div key={c.id} style={{ display: "grid", gap: ".4rem" }}>
          <DiscountForm camps={camps ?? []} code={{ ...c, expires_at: toLondonInput(c.expires_at) }} />
          <form action={deleteDiscount.bind(null, c.id)}><button className="link" style={{ color: "var(--bad)" }}>Delete {c.code}</button></form>
        </div>
      ))}
      <h2>New code</h2>
      <DiscountForm camps={camps ?? []} code={null} />
    </>
  );
}
