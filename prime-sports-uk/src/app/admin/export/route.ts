import { NextResponse, type NextRequest } from "next/server";
import { audit, getViewer } from "@/lib/auth";
import { LEAD_TABLES, toCsv, type LeadTab } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

// CSV downloads for the owner: lead lists, and camp-day registers (audited).
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "owner" || viewer.aal !== "aal2") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const supabase = await createClient();
  if (!(type in LEAD_TABLES)) return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  const cfg = LEAD_TABLES[type as LeadTab];
  const { data } = await supabase.from(cfg.table).select("*").order("created_at");
  await audit("export_csv", cfg.table, null, { rows: data?.length ?? 0 });
  const csv = toCsv((data ?? []) as Record<string, unknown>[], cfg.columns);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
