import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { MfaClient } from "./MfaClient";

export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") ? sp.next : "/admin";
  const viewer = await requireViewer(`/admin/mfa?next=${encodeURIComponent(next)}`);
  if (viewer.role === "parent") redirect("/account");
  if (viewer.aal === "aal2") redirect(next);
  return (
    <main className="admin-main" style={{ maxWidth: 520 }}>
      <h1 className="admin-title">Two-step sign-in</h1>
      <p className="muted">Staff and owner accounts need a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password) as well as the email link. This protects children&apos;s medical information.</p>
      <MfaClient next={next} />
    </main>
  );
}
