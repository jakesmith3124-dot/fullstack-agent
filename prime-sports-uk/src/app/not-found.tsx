import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="center">
          <div className="wrap" style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
            <div className="eyebrow">Page not found</div>
            <h1>We couldn&apos;t find that page</h1>
            <p className="muted">It may have moved when we updated our website.</p>
            <div className="actions"><Link className="btn" href="/">Go to the homepage</Link><Link className="btn ghost" href="/camps">Find a camp</Link></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
