import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Role } from "./types";

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  aal: "aal1" | "aal2";
  fullName: string | null;
  phone: string | null;
};

/** The signed-in visitor, verified against Supabase's signing keys. Null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name, phone")
    .eq("id", claims.sub)
    .maybeSingle();
  return {
    id: claims.sub,
    email: (profile?.email as string) ?? (claims.email as string) ?? "",
    role: (profile?.role as Role) ?? "parent",
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
  };
});

export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

/** Staff and owners must have passed 2FA on this session before seeing any admin page. */
export async function requireStaff(next = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (viewer.role === "parent") redirect("/account");
  if (viewer.aal !== "aal2") redirect(`/admin/mfa?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requireOwner(next = "/admin"): Promise<Viewer> {
  const viewer = await requireStaff(next);
  if (viewer.role !== "owner") redirect("/admin/register");
  return viewer;
}

/** For server actions: returns the viewer or throws (never trusts the client). */
export async function assertOwner(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "owner" || viewer.aal !== "aal2") throw new Error("Not allowed");
  return viewer;
}

export async function assertStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "parent" || viewer.aal !== "aal2") throw new Error("Not allowed");
  return viewer;
}

export async function audit(action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_audit", { p_action: action, p_entity: entity, p_entity_id: entityId, p_meta: meta });
  if (error) console.error("audit", error.message);
}
