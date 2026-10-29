import type { CampCardData } from "@/components/CampCard";
import { isBookable } from "./data";
import type { CampWithDays, Flags } from "./types";

export function toCardData(c: CampWithDays, flags: Flags): CampCardData & { address: string | null; postcode: string | null } {
  return {
    slug: c.slug,
    school: c.school,
    area: c.area,
    address: c.address,
    postcode: c.postcode,
    age_min: c.age_min,
    age_max: c.age_max,
    start_time: c.start_time,
    end_time: c.end_time,
    price_per_day_pence: c.price_per_day_pence,
    photo_path: c.photo_path,
    photo_alt: c.photo_alt,
    logo_path: c.logo_path,
    is_demo: c.is_demo,
    bookable: isBookable(c, flags),
    days: c.days.map((d) => ({ date: d.date, capacity: d.capacity, taken: d.taken })),
  };
}
