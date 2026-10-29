import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function SecureAdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireStaff("/admin");
  return (
    <>
      <header className="admin-bar">
        <div className="in">
          <Link href={viewer.role === "owner" ? "/admin" : "/admin/register"} style={{ font: "800 1.3rem var(--display)", textTransform: "uppercase" }}>
            Prime <span style={{ color: "var(--accent)" }}>Sports</span> UK · Admin
          </Link>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
            <Link href="/" style={{ fontSize: ".9rem" }}>View site</Link>
            <form action="/auth/signout" method="post"><button className="btn small ghost" style={{ color: "#fff" }}>Sign out</button></form>
          </div>
        </div>
        <AdminNav owner={viewer.role === "owner"} />
      </header>
      <main className="admin-main">{children}</main>
    </>
  );
}
