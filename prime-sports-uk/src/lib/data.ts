import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { todayLondon } from "./format";
import { DEFAULT_INSTALMENT_RULES, type InstalmentRules } from "./pricing";
import type { AgeGroup, Camp, CampDay, CampWithDays, ContentItem, Flags } from "./types";

// Public reads are cached and tagged; admin saves call revalidateTag("public") to refresh them.
const PUBLIC_TAG = "public";
const REVALIDATE = 300;

const DEFAULT_FLAGS: Flags = { bookings_open: true, prime_camps_bookings: false, goat_memberships: false, holiday_pass: false };

type SettingRow = { key: string; value: unknown; confirmed: boolean };

export const getSettings = unstable_cache(
  async (): Promise<Record<string, SettingRow>> => {
    const { data, error } = await createPublicClient().from("settings").select("key, value, confirmed");
    if (error) {
      console.error("settings", error.message);
      return {};
    }
    return Object.fromEntries((data ?? []).map((r) => [r.key, r as SettingRow]));
  },
  ["settings"],
  { tags: [PUBLIC_TAG, "settings"], revalidate: REVALIDATE },
);

export async function getFlags(): Promise<Flags> {
  const s = await getSettings();
  return { ...DEFAULT_FLAGS, ...((s.flags?.value as Partial<Flags>) ?? {}) };
}

/** Sibling discount as a percentage, and whether the owner has confirmed the amount. */
export async function getSiblingDiscount(): Promise<{ pct: number; confirmed: boolean }> {
  const s = await getSettings();
  return { pct: Number(s.sibling_discount_pct?.value ?? 0), confirmed: !!s.sibling_discount_pct?.confirmed };
}

export async function getInstalmentRules(): Promise<InstalmentRules> {
  const s = await getSettings();
  return { ...DEFAULT_INSTALMENT_RULES, ...((s.instalments?.value as Partial<InstalmentRules>) ?? {}) };
}

export async function getAgeGroups(): Promise<{ groups: AgeGroup[]; confirmed: boolean }> {
  const s = await getSettings();
  return { groups: (s.age_groups?.value as AgeGroup[]) ?? [], confirmed: !!s.age_groups?.confirmed };
}

export const getAllContent = unstable_cache(
  async (): Promise<ContentItem[]> => {
    // RLS returns only confirmed, visible items to the public client.
    const { data, error } = await createPublicClient()
      .from("content_items")
      .select("id, key, section, kind, data, confirmed, tbc_note, is_visible, sort_order")
      .order("sort_order");
    if (error) {
      console.error("content", error.message);
      return [];
    }
    return (data ?? []) as ContentItem[];
  },
  ["content"],
  { tags: [PUBLIC_TAG, "content"], revalidate: REVALIDATE },
);

/** Confirmed content, keyed for easy lookup. Missing keys mean "hidden". */
export async function getContent() {
  const items = await getAllContent();
  const byKey = new Map(items.map((i) => [i.key, i]));
  return {
    get<T = Record<string, string>>(key: string): T | null {
      return (byKey.get(key)?.data as T) ?? null;
    },
    section<T = Record<string, string>>(section: string): (ContentItem<T>)[] {
      return items.filter((i) => i.section === section) as ContentItem<T>[];
    },
  };
}

const CAMP_COLUMNS =
  "id, slug, brand, school, area, address, postcode, description, age_min, age_max, start_time, end_time, price_per_day_pence, full_week_price_pence, booking_opens_at, booking_closes_at, photo_path, photo_alt, logo_path, logo_original_path, what_to_bring, timetable, sort_order, is_visible, confirmed, is_demo";

const loadCamps = unstable_cache(
  async (): Promise<Camp[]> => {
    const { data, error } = await createPublicClient().from("camps").select(CAMP_COLUMNS).order("sort_order").order("school");
    if (error) {
      console.error("camps", error.message);
      return [];
    }
    return (data ?? []) as Camp[];
  },
  ["camps"],
  { tags: [PUBLIC_TAG, "camps"], revalidate: REVALIDATE },
);

/** Availability is not cached: spaces change with every booking. */
export async function getCampDays(campId: string): Promise<CampDay[]> {
  const { data, error } = await createPublicClient().rpc("camp_availability", { p_camp: campId });
  if (error) {
    console.error("availability", error.message);
    return [];
  }
  return (data ?? []) as CampDay[];
}

/** Camps with at least one day from today onwards, with live availability. */
export async function getUpcomingCamps(): Promise<CampWithDays[]> {
  const today = todayLondon();
  const camps = await loadCamps();
  const withDays = await Promise.all(camps.map(async (c) => ({ ...c, days: await getCampDays(c.id) })));
  return withDays
    .map((c) => ({ ...c, days: c.days.filter((d) => d.date >= today) }))
    .filter((c) => c.days.length > 0);
}

export async function getCampBySlug(slug: string): Promise<CampWithDays | null> {
  const camp = (await loadCamps()).find((c) => c.slug === slug);
  if (!camp) return null;
  return { ...camp, days: await getCampDays(camp.id) };
}

export async function getCampSlugs(): Promise<{ slug: string; area: string }[]> {
  return (await loadCamps()).map((c) => ({ slug: c.slug, area: c.area }));
}

export function isBookable(camp: Camp, flags: Flags, now = new Date()): boolean {
  if (!flags.bookings_open) return false;
  if (camp.brand === "prime_camps" && !flags.prime_camps_bookings) return false;
  if (camp.booking_opens_at && new Date(camp.booking_opens_at) > now) return false;
  if (camp.booking_closes_at && new Date(camp.booking_closes_at) < now) return false;
  return true;
}
