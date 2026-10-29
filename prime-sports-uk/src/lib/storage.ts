import { SUPABASE_URL } from "./env";

/** Public URL for a file in the public "site" bucket. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/site/${path.split("/").map(encodeURIComponent).join("/")}`;
}
