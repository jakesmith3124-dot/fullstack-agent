import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PromoBar } from "@/components/PromoBar";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PromoBar />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
