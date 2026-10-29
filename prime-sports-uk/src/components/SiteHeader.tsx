"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DARTS_URL } from "@/lib/env";

const NAV = [
  { href: "/camps", label: "Holiday Camps" },
  { href: "/prime-camps", label: "Prime Camps" },
  { href: "/goat", label: "G.O.A.T" },
  { href: "/schools", label: "Schools" },
  { href: "/safety", label: "Safety" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brands">
          <Link className="brand-mark" href="/" aria-label="Prime Sports UK home">
            <Image src="/brand/psuk-logo.png" alt="Prime Sports UK" width={45} height={58} priority />
          </Link>
          <span className="brand-sep" aria-hidden="true" />
          <a className="brand-mark darts" href={DARTS_URL} target="_blank" rel="noopener" aria-label="Visit Prime Sports Darts (opens in a new tab)">
            <Image src="/brand/psd-logo.png" alt="Prime Sports Darts" width={62} height={44} />
          </a>
        </div>
        <button className="menu-btn" type="button" aria-expanded={open} aria-controls="mainNav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
        <nav id="mainNav" className={`main-nav${open ? " open" : ""}`} aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="md-hide">
              <Link href="/account">My account</Link>
            </li>
          </ul>
        </nav>
        <div className="head-actions head-cta">
          <Link className="head-account" href="/account">My account</Link>
          <Link className="btn" href="/camps">Make a Booking</Link>
        </div>
      </div>
    </header>
  );
}
