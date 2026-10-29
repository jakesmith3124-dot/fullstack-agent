export type Role = "owner" | "staff" | "parent";

export type Camp = {
  id: string;
  slug: string;
  brand: "holiday" | "prime_camps";
  school: string;
  area: string;
  address: string | null;
  postcode: string | null;
  description: string | null;
  age_min: number;
  age_max: number;
  start_time: string;
  end_time: string;
  price_per_day_pence: number;
  full_week_price_pence: number | null;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  photo_path: string | null;
  photo_alt: string | null;
  logo_path: string | null;
  logo_original_path: string | null;
  what_to_bring: string | null;
  timetable: [string, string, string][];
  sort_order: number;
  is_visible: boolean;
  confirmed: boolean;
  is_demo: boolean;
};

export type CampDay = { day_id: string; date: string; capacity: number; taken: number };
export type CampWithDays = Camp & { days: CampDay[] };

export type ContentItem<T = Record<string, unknown>> = {
  id: string;
  key: string;
  section: string;
  kind: string;
  data: T;
  confirmed: boolean;
  tbc_note: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type Flags = {
  bookings_open: boolean;
  prime_camps_bookings: boolean;
  goat_memberships: boolean;
  holiday_pass: boolean;
};

export type AgeGroup = { name: string; min: number; max: number };
