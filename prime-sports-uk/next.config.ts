import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321");
  } catch {
    return new URL("http://127.0.0.1:54321");
  }
})();

// Content Security Policy. Next.js needs inline scripts for hydration; everything else is locked down.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://challenges.cloudflare.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHost.origin} https://*.stripe.com`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseHost.origin} ${supabaseHost.origin.replace(/^http/, "ws")} https://api.stripe.com https://challenges.cloudflare.com https://vitals.vercel-insights.com`,
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tailwind CSS v4 runs through its Turbopack loader.
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseHost.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseHost.hostname,
        port: supabaseHost.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Local Supabase runs on 127.0.0.1 during development only.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/app" }] },
    ];
  },
  // 301s from the old Wix site. Check these against the Wix sitemap before the domain switch.
  async redirects() {
    return [
      { source: "/holidaycamps", destination: "/camps", permanent: true },
      { source: "/holiday-camps", destination: "/camps", permanent: true },
      { source: "/book-online", destination: "/camps", permanent: true },
      { source: "/booking", destination: "/camps", permanent: true },
      { source: "/bookings", destination: "/camps", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/aboutus", destination: "/about", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/contactus", destination: "/contact", permanent: true },
      { source: "/services", destination: "/#services", permanent: true },
      { source: "/our-services", destination: "/#services", permanent: true },
      { source: "/schools-1", destination: "/schools", permanent: true },
      { source: "/school-services", destination: "/schools", permanent: true },
      { source: "/football", destination: "/goat", permanent: true },
      { source: "/football-academy", destination: "/goat", permanent: true },
      { source: "/faqs", destination: "/faq", permanent: true },
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/terms-and-conditions", destination: "/terms", permanent: true },
      { source: "/blank", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
