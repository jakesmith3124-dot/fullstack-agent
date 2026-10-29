import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

// Self-hosted by next/font at build time: no requests to Google from visitors' browsers.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Prime Sports UK | Children's sports coaching and holiday camps in West Yorkshire",
    template: "%s | Prime Sports UK",
  },
  description:
    "Holiday camps, football development, school PE and community sport for children across Halifax, Bradford, Calderdale and Kirklees.",
  openGraph: { siteName: "Prime Sports UK", locale: "en_GB", type: "website" },
  icons: { icon: "/brand/psuk-logo.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        {/* Vercel's cookie-free analytics only works when hosted on Vercel. */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
