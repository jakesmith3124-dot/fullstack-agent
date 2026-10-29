import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";
import { CONTACT_EMAIL, FACEBOOK_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with Prime Sports UK about holiday camps, football coaching or working with your school.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="eyebrow">Contact</div>
          <h1>Get in touch</h1>
          <p>Questions about a camp, a booking or working with your school? Send us a message and we&apos;ll get back to you.</p>
        </div>
      </div>
      <section>
        <div className="wrap pc-reg-wrap">
          <div className="prose">
            <h2 style={{ marginTop: 0 }}>Email</h2>
            <p><a href={`mailto:${CONTACT_EMAIL}`}><b>{CONTACT_EMAIL}</b></a></p>
            <h2>Facebook</h2>
            <p><a href={FACEBOOK_URL} target="_blank" rel="noopener">facebook.com/PSUK25</a></p>
            <h2>Where we work</h2>
            <p>Halifax, Bradford, Calderdale, Kirklees and surrounding West Yorkshire.</p>
          </div>
          <LeadForm kind="contact" />
        </div>
      </section>
    </>
  );
}
