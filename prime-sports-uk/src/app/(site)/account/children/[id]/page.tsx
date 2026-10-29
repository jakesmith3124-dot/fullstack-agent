import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChildForm } from "./ChildForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Child's details", robots: { index: false } };

export default async function ChildPage({ params }: PageProps<"/account/children/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer(`/account/children/${id}`);
  const isNew = id === "new";
  let child = null;
  let signatures: { form_key: string; form_version: number; signed_name: string; signed_at: string }[] = [];
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase.from("children").select("id, first_name, last_name, dob, school, medical, allergies, send, photo_consent, collectors").eq("id", id).eq("parent_id", viewer.id).maybeSingle();
    if (!data) notFound();
    child = data;
    const { data: sigs } = await supabase.from("consent_signatures").select("form_key, form_version, signed_name, signed_at").eq("child_id", id).order("signed_at", { ascending: false });
    signatures = sigs ?? [];
  }
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow"><Link href="/account#children">← My account</Link></div>
          <h1>{child ? `${child.first_name} ${child.last_name}` : "Add a child"}</h1>
          <p>Medical, allergy and SEND details are optional. Only the staff at your child&apos;s camp see them, and they&apos;re deleted 12 months after their last camp.</p>
        </div>
      </div>
      <section>
        <div className="wrap" style={{ maxWidth: 760, display: "grid", gap: "1.2rem" }}>
          <ChildForm child={child} />
          {child && (
            <div className="card">
              <h2 className="h3-size">Consent forms</h2>
              {signatures.length ? (
                <ul>{signatures.map((s, i) => <li key={i}>{s.form_key.replace(/_/g, " ")} (version {s.form_version}), signed by {s.signed_name} on {new Date(s.signed_at).toLocaleDateString("en-GB")}</li>)}</ul>
              ) : <p className="muted">No forms signed yet.</p>}
              <Link className="btn ghost small" href="/app/child">Sign forms in the app</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
