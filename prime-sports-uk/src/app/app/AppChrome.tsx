"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/parent-app";
import { VAPID_PUBLIC_KEY } from "@/lib/env";

const ICONS: Record<string, string> = {
  today: '<path d="M3 10h18M8 3v4M16 3v4"/><rect x="3" y="5" width="18" height="16" rx="3"/>',
  updates: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="3.5"/>',
  pickup: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  child: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const TABS: [string, string, string][] = [["/app", "today", "Today"], ["/app/updates", "updates", "Updates"], ["/app/pickup", "pickup", "Pickup"], ["/app/child", "child", "Child"]];

export function AppTabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="App sections">
      <div className="in">
        {TABS.map(([href, icon, label]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[icon] }} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/app" }).catch(() => null);
  }, []);
  return null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Bell in the top bar: turns push notifications on or off for this phone. */
export function NotificationBell() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied">("off");
  const [toast, setToast] = useState("");
  useEffect(() => {
    // Browser capabilities are only known after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off")).catch(() => null);
  }, []);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  async function toggle() {
    if (state === "unsupported") return say("Add this app to your home screen to get notifications. We'll email you instead.");
    if (state === "denied") return say("Notifications are blocked in your phone's settings.");
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await removePushSubscription(existing.endpoint);
      await existing.unsubscribe();
      setState("off");
      return say("Notifications off");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return say("Notifications not allowed"); }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const r = await savePushSubscription(sub.toJSON());
    setState("on");
    say(r.message || "Notifications on");
  }
  return (
    <>
      <button className="icon-btn" type="button" onClick={toggle} aria-label={state === "on" ? "Turn notifications off" : "Turn notifications on"} aria-pressed={state === "on"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {state === "on" && <span className="dot" />}
      </button>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
