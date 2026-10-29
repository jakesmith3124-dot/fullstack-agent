import type { Metadata } from "next";
import Link from "next/link";
import { SafetyGrid } from "@/components/SafetyGrid";
import { getContent } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Safety and safeguarding",
  description: "How Prime Sports UK keeps children safe: DBS-checked staff, signing in and out, and releasing children only to named adults.",
  alternates: { canonical: "/safety" },
};

export default async function SafetyPage() {
  const content = await getContent();
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Safety &amp; trust</div>
          <h1>Your child is in safe hands</h1>
          <p>Parents and schools trust us with children every week. This is how we keep them safe.</p>
        </div>
      </div>
      <SafetyGrid content={content} />
      <section>
        <div className="wrap prose">
          <h2>Medical needs, allergies and SEND</h2>
          <p>Tell us about any medical conditions, allergies or additional needs when you book. Staff see this on their register for the day, and for more complex needs we&apos;ll talk to you before the camp.</p>
          <h2>Collection</h2>
          <p>Children are only released to adults named on the booking. In the Prime Camps app you can choose who is collecting each day and show a pickup pass at the gate.</p>
          <h2>Photos</h2>
          <p>We only share photos of children whose parents have given permission, and you can change your mind at any time from your account.</p>
          <p><Link className="btn ghost" href="/safeguarding-policy">Read our safeguarding policy</Link> <Link className="btn ghost" href="/faq">Parent FAQ</Link></p>
        </div>
      </section>
    </>
  );
}
