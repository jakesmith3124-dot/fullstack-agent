import type { MetadataRoute } from "next";
import { getCampSlugs } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { slugify } from "@/lib/format";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const camps = await getCampSlugs();
  const areas = [...new Set(["Halifax", "Bradford", "Calderdale", "Kirklees", ...camps.map((c) => c.area)])];
  const pages = ["", "/camps", "/prime-camps", "/goat", "/schools", "/safety", "/faq", "/about", "/contact", "/privacy", "/cookies", "/terms", "/booking-terms", "/safeguarding-policy"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...camps.map((c) => ({ url: `${SITE_URL}/camps/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...areas.map((a) => ({ url: `${SITE_URL}/holiday-camps/${slugify(a)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
