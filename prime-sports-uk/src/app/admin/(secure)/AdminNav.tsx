"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const OWNER = [
  ["/admin", "Dashboard"], ["/admin/camps", "Camps"], ["/admin/bookings", "Bookings"], ["/admin/register", "Registers"],
  ["/admin/reports", "Reports"], ["/admin/waiting-lists", "Waiting lists"], ["/admin/content", "Content"],
  ["/admin/discounts", "Discounts"], ["/admin/settings", "Settings"], ["/admin/leads", "Sign-ups"],
  ["/admin/memberships", "Memberships"], ["/admin/staff", "Staff"], ["/admin/audit", "Audit log"],
];
const STAFF = [["/admin/register", "My registers"]];

export function AdminNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const items = owner ? OWNER : STAFF;
  return (
    <nav className="admin-nav" aria-label="Admin">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/admin" ? path === "/admin" : path.startsWith(href)) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
