import Link from "next/link";
import { CONTACT_EMAIL, FACEBOOK_URL } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <Link className="foot-logo" href="/">
              Prime <span>Sports</span> UK
            </Link>
            <p style={{ marginTop: ".6rem" }}>
              Children&apos;s sports coaching, holiday camps and football development across West Yorkshire.
            </p>
          </div>
          <div>
            <h2>Parents</h2>
            <ul>
              <li><Link href="/camps">Holiday Camps</Link></li>
              <li><Link href="/prime-camps">Prime Camps</Link></li>
              <li><Link href="/goat">G.O.A.T (coming 2027)</Link></li>
              <li><Link href="/faq">Parent FAQ</Link></li>
              <li><Link href="/safety">Safety</Link></li>
              <li><Link href="/account">My account</Link></li>
              <li><Link href="/app">Prime Camps app</Link></li>
            </ul>
          </div>
          <div>
            <h2>Schools</h2>
            <ul>
              <li><Link href="/schools">School PE Support</Link></li>
              <li><Link href="/schools#services">Clubs &amp; Enrichment</Link></li>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Get in Touch</Link></li>
            </ul>
          </div>
          <div>
            <h2>Contact</h2>
            <ul>
              <li><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
              <li><a href={FACEBOOK_URL} target="_blank" rel="noopener">Facebook</a></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} Prime Sports UK</span>
          <nav aria-label="Legal">
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/booking-terms">Booking terms</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/cookies">Cookie Policy</Link>
            <Link href="/safeguarding-policy">Safeguarding</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
