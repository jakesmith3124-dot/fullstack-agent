"use client";
import { useActionState, useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type Result = { ok: boolean; error?: string; message?: string };

/**
 * Upload with an optional crop step. Images are cropped and resized in the browser before
 * upload, so phone photos stay small and fast on mobile data.
 */
export function ImageUpload({ action, aspect, label, altLabel, defaultAlt, previewUrl, previewShape = "rect", maxSize = 1800 }: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  aspect?: number;
  label: string;
  altLabel?: string;
  defaultAlt?: string;
  previewUrl?: string | null;
  previewShape?: "rect" | "circle";
  maxSize?: number;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState("");
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  async function submit(fd: FormData) {
    setError("");
    if (!src) return setError("Choose an image first.");
    const img = await loadImage(src);
    const sx = aspect && area ? area.x : 0;
    const sy = aspect && area ? area.y : 0;
    const sw = aspect && area ? area.width : img.naturalWidth;
    const sh = aspect && area ? area.height : img.naturalHeight;
    const scale = Math.min(1, maxSize / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    // Logos keep their transparency (PNG); photos become JPEG.
    const type = aspect ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
    if (!blob) return setError("We couldn't read that image.");
    fd.set("file", new File([blob], aspect ? "photo.jpg" : "logo.png", { type }));
    formAction(fd);
    setSrc(null);
  }

  return (
    <form action={submit} className="card" style={{ gap: ".8rem" }}>
      <h3>{label}</h3>
      {previewUrl && !src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Current image" style={previewShape === "circle"
          ? { width: 96, height: 96, borderRadius: "50%", background: "#000", objectFit: "contain", padding: 8, border: "4px solid var(--surface)", boxShadow: "0 6px 16px rgba(0,0,0,.25)" }
          : { width: "100%", aspectRatio: aspect ?? "auto", objectFit: "cover", borderRadius: 14 }} />
      )}
      {src && aspect && (
        <div style={{ position: "relative", height: 280, background: "#222", borderRadius: 14, overflow: "hidden" }}>
          <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
        </div>
      )}
      {src && aspect && (
        <label className="field">Zoom<input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
      )}
      {src && !aspect && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="New image preview" style={{ maxWidth: 160, maxHeight: 160, objectFit: "contain", background: "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/16px 16px", borderRadius: 8 }} />
      )}
      <label className="field">Choose image
        <input type="file" accept="image/png,image/jpeg,image/webp,image/heic" onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 25 * 1024 * 1024) return setError("That file is very large. Try a smaller photo.");
          setSrc(URL.createObjectURL(f));
          setZoom(1);
        }} />
      </label>
      {altLabel && <label className="field">{altLabel}<input name="alt" defaultValue={defaultAlt} placeholder="Describe the photo for screen readers" /></label>}
      <p className="err" role="alert">{error || state.error}</p>
      {state.message && <p className="okmsg" role="status">{state.message}</p>}
      <button className="btn small" type="submit" disabled={pending || !src} style={{ justifySelf: "start" }}>{pending ? "Uploading…" : "Upload"}</button>
    </form>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
