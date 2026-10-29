import { CONTACT_EMAIL, FACEBOOK_URL, SITE_URL } from "@/lib/env";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: "Prime Sports UK",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/psuk-logo.png`,
    email: CONTACT_EMAIL,
    sameAs: [FACEBOOK_URL],
    description: "Children's sports coaching, holiday camps and football development across West Yorkshire.",
    areaServed: ["Halifax", "Bradford", "Calderdale", "Kirklees", "West Yorkshire"].map((name) => ({ "@type": "Place", name })),
    slogan: "Hard Work Beats Talent",
  };
}
