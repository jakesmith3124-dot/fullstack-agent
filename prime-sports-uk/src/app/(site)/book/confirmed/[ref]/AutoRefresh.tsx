"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ every = 3000, max = 20 }: { every?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => { if (++n > max) clearInterval(t); else router.refresh(); }, every);
    return () => clearInterval(t);
  }, [router, every, max]);
  return null;
}
