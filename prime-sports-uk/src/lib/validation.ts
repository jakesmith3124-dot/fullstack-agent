// Zod schemas shared by browser forms and server actions.
import { z } from "zod";

export const AREAS = ["Halifax", "Bradford", "Calderdale (other)", "Kirklees / Huddersfield", "Leeds", "Somewhere else"] as const;

const name = z.string().trim().min(1, "Add your first name.").max(80);
const email = z.email("Enter a valid email address so we can contact you.").trim().max(200);
const phone = z.string().trim().max(30).regex(/^[0-9 +()-]*$/, "Enter a valid phone number.");
const mustTick = (msg: string) => z.literal("on", { error: msg });

export const earlyAccessSchema = z.object({
  first_name: name,
  email,
  area: z.enum(AREAS, { error: "Choose your area so we can plan venues." }),
  children_ages: z.string().trim().max(60).optional().default(""),
  consent: mustTick("Tick the box so we're allowed to email you about bookings."),
});

export const goatSchema = z.object({
  first_name: name,
  email,
  area: z.enum(AREAS, { error: "Choose your area so we can plan where sessions run." }),
  player_age: z.string().trim().max(20).optional().default(""),
  consent: mustTick("Tick the box so we're allowed to email you."),
});

export const SCHOOL_INTERESTS = [
  "PE support",
  "Breakfast club",
  "Lunchtime club",
  "After-school club",
  "Enrichment days",
  "HAF and funded programmes",
] as const;

export const schoolSchema = z.object({
  school_name: z.string().trim().min(2, "Add your school's name.").max(120),
  contact_name: z.string().trim().min(2, "Add your name.").max(80),
  role: z.string().trim().max(80).optional().default(""),
  email,
  phone: phone.optional().default(""),
  interests: z.array(z.enum(SCHOOL_INTERESTS)).min(1, "Choose at least one thing you're interested in."),
  message: z.string().trim().max(2000).optional().default(""),
  consent: mustTick("Tick the box so we can reply to your enquiry."),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Add your name.").max(80),
  email,
  phone: phone.optional().default(""),
  message: z.string().trim().min(5, "Add a short message.").max(4000),
  consent: mustTick("Tick the box so we can reply to you."),
});

// --- Booking ---------------------------------------------------------------
const ukPhone = z
  .string()
  .trim()
  .min(10, "Enter a phone number.")
  .max(20)
  .regex(/^[0-9 +()-]+$/, "Enter a valid phone number.");

export const childSchema = z.object({
  id: z.uuid().optional(),
  first_name: z.string().trim().min(1, "add their first name and surname.").max(60),
  last_name: z.string().trim().min(1, "add their first name and surname.").max(60),
  dob: z.iso.date("add their date of birth."),
  school: z.string().trim().max(120).optional().default(""),
  medical: z.string().trim().max(1000).optional().default(""),
  allergies: z.string().trim().max(500).optional().default(""),
  send: z.string().trim().max(500).optional().default(""),
  collectors: z.string().trim().min(2, "tell us who can collect them.").max(300),
  photo_consent: z.enum(["yes", "no"], { error: "choose a photo option." }),
});
export type ChildInput = z.infer<typeof childSchema>;

export const parentSchema = z.object({
  name: z.string().trim().min(2, "Add your name and mobile number.").max(80),
  phone: ukPhone,
  email: z.email("Enter a valid email so we can send your confirmation.").trim().max(200),
  emergency_name: z.string().trim().min(2, "Add an emergency contact name and phone number.").max(80),
  emergency_phone: ukPhone,
  emergency_relationship: z.string().trim().max(60).optional().default(""),
});
export type ParentInput = z.infer<typeof parentSchema>;

export const bookingSchema = z.object({
  camp_slug: z.string().min(1).max(120),
  day_ids: z.array(z.uuid()).min(1, "Pick at least one day.").max(30),
  children: z.array(childSchema).min(1).max(6),
  parent: parentSchema,
  plan: z.union([z.literal("full"), z.number().int().min(2).max(6)]),
  code: z.string().trim().max(40).optional().default(""),
  terms: z.literal(true, { error: "Tick the box to agree to the booking terms." }),
});
export type BookingInput = z.infer<typeof bookingSchema>;

export function splitCollectors(s: string): string[] {
  return s
    .split(/[,;\n]| and /i)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Please check the form and try again.";
}
