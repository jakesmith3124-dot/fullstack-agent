import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { LEAD_TABLES, type LeadTab } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

export default async function Leads({ searchParams }: PageProps<"/admin/leads">) {
  await requireOwner("/admin/leads");
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" && sp.tab in LEAD_TABLES ? sp.tab : "early_access") as LeadTab;
  const cfg = LEAD_TABLES[tab];
  const supabase = await createClient();
  const { data } = await supabase.from(cfg.table).select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  const byArea = new Map<string, number>();
  for (const r of rows) if (r.area) byArea.set(String(r.area), (byArea.get(String(r.area)) ?? 0) + 1);
  return (
    <>
      <h1 className="admin-title">Sign-ups and enquiries</h1>
      <nav className="chips" aria-label="Lists">
        {(Object.keys(LEAD_TABLES) as LeadTab[]).map((k) => (
          <Link key={k} className="chip" aria-current={k === tab ? "page" : undefined} style={k === tab ? { background: "var(--accent)", borderColor: "var(--accent)" } : undefined} href={`/admin/leads?tab=${k}`}>{LEAD_TABLES[k].label}</Link>
        ))}
      </nav>
      <div className="card">
        <div className="row">
          <h2>{cfg.label} <span className="tag gold">{rows.length}</span></h2>
          <a className="btn small" href={`/admin/export?type=${tab}`}>Download CSV</a>
        </div>
        {byArea.size > 0 && <div className="chips">{[...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => <span key={a} className="tag">{a} · {n}</span>)}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr>{cfg.columns.filter((c) => !c.startsWith("consent") && c !== "marketing_consent").map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  {cfg.columns.filter((c) => !c.startsWith("consent") && c !== "marketing_consent").map((c) => (
                    <td key={c}>{c === "created_at" ? fmtDateTime(String(r[c])) : Array.isArray(r[c]) ? (r[c] as string[]).join(", ") : String(r[c] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="muted">Nothing yet.</p>}
      </div>
    </>
  );
}
