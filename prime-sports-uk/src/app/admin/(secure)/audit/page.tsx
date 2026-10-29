import { requireOwner } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function AuditLog() {
  await requireOwner("/admin/audit");
  const supabase = await createClient();
  const { data } = await supabase.from("audit_log").select("id, action, entity, entity_id, meta, created_at, actor_id").order("created_at", { ascending: false }).limit(300);
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: people } = actorIds.length ? await supabase.from("profiles").select("id, email, full_name").in("id", actorIds) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  return (
    <>
      <h1 className="admin-title">Audit log</h1>
      <p className="muted">Who viewed or exported registers and children&apos;s details, and other important changes. The latest 300 entries.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}><td>{fmtDateTime(r.created_at)}</td><td>{r.actor_id ? who.get(r.actor_id) ?? "Unknown" : "System"}</td><td>{r.action.replace(/_/g, " ")}</td><td className="muted">{r.entity}{r.entity_id ? ` ${r.entity_id.slice(0, 8)}` : ""} {Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
