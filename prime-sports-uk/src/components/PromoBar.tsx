import Link from "next/link";
import { getContent } from "@/lib/data";

/** Shown only once the owner has confirmed the promo message in admin. */
export async function PromoBar() {
  const promo = (await getContent()).get<{ text: string; link_label?: string; href?: string }>("home.promo");
  if (!promo?.text) return null;
  return (
    <div className="promo">
      <div className="wrap">
        {promo.text}
        {promo.href && <Link href={promo.href}>{promo.link_label || "Find out more →"}</Link>}
      </div>
    </div>
  );
}
