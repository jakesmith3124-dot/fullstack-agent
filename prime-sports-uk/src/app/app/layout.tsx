import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { AppTabs, NotificationBell, SwRegister } from "./AppChrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Prime Camps", template: "%s | Prime Camps" },
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "Prime Camps", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/app-apple-touch.png" },
  robots: { index: false },
};
export const viewport: Viewport = { themeColor: "#0b0b0b", viewportFit: "cover" };

export default async function ParentAppLayout({ children }: LayoutProps<"/app">) {
  await requireViewer("/app");
  return (
    <div className="pa">
      <div className="pa-shell">
        <header className="pa-top">
          <div className="pa-pad">
            <Link className="pa-brand" href="/app">
              <Image src="/brand/prime-camps-logo.png" alt="" width={37} height={40} priority />
              <b>Prime <span>Camps</span></b>
            </Link>
            <NotificationBell />
          </div>
        </header>
        {children}
      </div>
      <AppTabs />
      <SwRegister />
    </div>
  );
}
