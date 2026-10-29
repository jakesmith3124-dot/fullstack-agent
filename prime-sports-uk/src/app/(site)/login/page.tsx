import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account";
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Your account</div>
          <h1>Sign in</h1>
          <p>We&apos;ll email you a secure sign-in link. No password needed.</p>
        </div>
      </div>
      <section>
        <div className="wrap" style={{ maxWidth: 520 }}>
          <LoginForm next={next} initialError={error} />
        </div>
      </section>
    </>
  );
}
