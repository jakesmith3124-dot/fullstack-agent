"use client";
import { useEffect, useState } from "react";
import type { TodayData } from "@/lib/parent-app";

const KEY = "pc-today";

/** Today's data, refreshed every 10 seconds while the app is open. Falls back to the last copy offline. */
export function useToday(initial: TodayData) {
  const [data, setData] = useState<TodayData>(initial);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(initial)); } catch { /* storage unavailable */ }
    let stop = false;
    async function load() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/app/today", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const next = (await res.json()) as TodayData;
        if (stop) return;
        setData(next);
        setOffline(false);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      } catch {
        setOffline(true);
        try { const cached = localStorage.getItem(KEY); if (cached) setData(JSON.parse(cached)); } catch { /* ignore */ }
      }
    }
    const t = setInterval(load, 10_000);
    document.addEventListener("visibilitychange", load);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", load); };
  }, [initial]);
  return { data, offline };
}

export function useSelectedKid(ids: string[]) {
  const [kid, setKid] = useState<string | null>(null);
  useEffect(() => {
    // Read after hydration so the server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const saved = localStorage.getItem("pc-kid"); if (saved) setKid(saved); } catch { /* ignore */ }
  }, []);
  const current = kid && ids.includes(kid) ? kid : ids[0] ?? null;
  return [current, (id: string) => { setKid(id); try { localStorage.setItem("pc-kid", id); } catch { /* ignore */ } }] as const;
}
