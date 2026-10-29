import { requireViewer } from "@/lib/auth";
import { getToday } from "@/lib/parent-app";
import { PickupView } from "./PickupView";

export const metadata = { title: "Pickup" };

export default async function PickupPage() {
  const viewer = await requireViewer("/app/pickup");
  return <PickupView initial={await getToday(viewer.id)} />;
}
