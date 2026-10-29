import "server-only";

export const LEAD_TABLES = {
  early_access: { table: "early_access_signups", label: "Prime Camps early access", columns: ["first_name", "email", "area", "children_ages", "marketing_consent", "consent_at", "created_at"] },
  goat: { table: "goat_waitlist", label: "G.O.A.T waiting list", columns: ["first_name", "email", "area", "player_age", "consent", "consent_at", "created_at"] },
  schools: { table: "school_enquiries", label: "School enquiries", columns: ["school_name", "contact_name", "role", "email", "phone", "interests", "message", "consent_at", "created_at"] },
  contact: { table: "contact_messages", label: "Contact messages", columns: ["name", "email", "phone", "message", "consent_at", "created_at"] },
} as const;

export type LeadTab = keyof typeof LEAD_TABLES;

export function toCsv(rows: Record<string, unknown>[], columns: readonly string[]): string {
  const cell = (v: unknown) => {
    let s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
    // Stop spreadsheet formula injection from form input.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}
