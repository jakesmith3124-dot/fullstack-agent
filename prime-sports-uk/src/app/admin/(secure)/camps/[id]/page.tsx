import Link from "next/link";
import { notFound } from "next/navigation";
import { clearCampImage, uploadCampLogo, uploadCampPhoto } from "@/app/actions/admin-camps";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { requireOwner } from "@/lib/auth";
import { toLondonInput } from "@/lib/admin";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { Camp } from "@/lib/types";
import { CampForm, DaysEditor, DeleteCampButton } from "./CampEditor";

export default async function CampEditPage({ params, searchParams }: PageProps<"/admin/camps/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireOwner(`/admin/camps/${id}`);
  const isNew = id === "new";
  let camp: Camp | null = null;
  let days: { id: string; date: string; capacity: number; taken: number }[] = [];
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase.from("camps").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    camp = data as Camp;
    const { data: avail } = await supabase.rpc("camp_availability", { p_camp: id });
    days = ((avail ?? []) as { day_id: string; date: string; capacity: number; taken: number }[]).map((d) => ({ id: d.day_id, date: d.date, capacity: d.capacity, taken: d.taken }));
  }
  return (
    <>
      <p><Link href="/admin/camps">← All camps</Link></p>
      <h1 className="admin-title">{camp ? camp.school : "Add a camp"}</h1>
      {sp.created && <p className="okmsg">Camp created. Now add its days, photo and school logo.</p>}
      <div className="camp-detail">
        <CampForm camp={camp ? { ...camp, booking_opens_at: toLondonInput(camp.booking_opens_at), booking_closes_at: toLondonInput(camp.booking_closes_at) } : null} />
        {camp && (
          <div style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
            <DaysEditor campId={camp.id} days={days} />
            <ImageUpload action={uploadCampLogo.bind(null, camp.id)} label="School logo (black circle)" previewUrl={publicImageUrl(camp.logo_path)} previewShape="circle" />
            {camp.logo_path && <form action={clearCampImage.bind(null, camp.id, "logo")}><button className="link">Remove logo (show initials)</button></form>}
            <p className="hint">We remove a plain white or flat background automatically, trim the edges and centre the logo. Your original file is kept.</p>
            <ImageUpload action={uploadCampPhoto.bind(null, camp.id)} aspect={16 / 11} label="Camp card photo" altLabel="Photo description" defaultAlt={camp.photo_alt ?? ""} previewUrl={publicImageUrl(camp.photo_path)} />
            {camp.photo_path && <form action={clearCampImage.bind(null, camp.id, "photo")}><button className="link">Remove photo</button></form>}
            <p className="hint">Only use real photos of children whose parents have given photo consent.</p>
            <DeleteCampButton campId={camp.id} />
          </div>
        )}
      </div>
    </>
  );
}
