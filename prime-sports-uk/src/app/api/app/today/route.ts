import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getToday } from "@/lib/parent-app";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const data = await getToday(viewer.id);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
