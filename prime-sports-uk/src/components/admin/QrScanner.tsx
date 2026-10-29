"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Camera QR scanner. Uses the browser's BarcodeDetector where available, with jsQR as a fallback. */
export function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const done = useRef(false);
  const handler = useRef(onCode);
  useEffect(() => { handler.current = onCode; }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    async function tick() {
      const v = video.current;
      if (!v || done.current) return;
      if (v.readyState >= 2) {
        try {
          let value: string | null = null;
          if (detector) value = (await detector.detect(v))[0]?.rawValue ?? null;
          else if (ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            value = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
          }
          if (value) {
            done.current = true;
            navigator.vibrate?.(80);
            handler.current(value);
            return;
          }
        } catch {
          /* keep scanning */
        }
      }
      raf = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => null);
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("We couldn't open the camera. Allow camera access, or type the pass code below."));
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      <video ref={video} playsInline muted style={{ width: "100%", maxHeight: 340, borderRadius: 14, background: "#000", objectFit: "cover" }} aria-label="Camera view for scanning the pickup pass" />
      {error && <p className="err">{error}</p>}
    </div>
  );
}
