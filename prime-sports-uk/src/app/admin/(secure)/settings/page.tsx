import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireOwner("/admin/settings");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value, confirmed");
  const s = Object.fromEntries((data ?? []).map((r) => [r.key, r])) as Record<string, { value: unknown; confirmed: boolean }>;
  return (
    <>
      <h1 className="admin-title">Settings</h1>
      <SettingsForm s={s} />
    </>
  );
}
