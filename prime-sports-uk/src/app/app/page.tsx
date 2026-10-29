import { requireViewer } from "@/lib/auth";
import { getToday } from "@/lib/parent-app";
import { TodayView } from "./TodayView";

export default async function TodayPage() {
  const viewer = await requireViewer("/app");
  return <TodayView initial={await getToday(viewer.id)} />;
}
