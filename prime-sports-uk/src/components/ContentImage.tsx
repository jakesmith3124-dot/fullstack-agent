import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";

/** An owner-editable photo. Shows the prototype's labelled placeholder until a real photo is uploaded. */
export function ContentImage({ path, alt, sizes, priority }: { path?: string | null; alt: string; sizes: string; priority?: boolean }) {
  const url = publicImageUrl(path);
  if (!url) return null;
  return <Image src={url} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />;
}
