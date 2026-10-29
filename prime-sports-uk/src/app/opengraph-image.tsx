import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Prime Sports UK: inspiring children to move, play and grow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/psuk-logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0b0b0b", display: "flex", alignItems: "center", padding: 80, gap: 60 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={231} height={300} alt="" />
        <div style={{ display: "flex", flexDirection: "column", color: "#fff" }}>
          <div style={{ color: "#d4a72c", fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>Prime Sports UK</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, textTransform: "uppercase", marginTop: 16 }}>Inspiring children to move, play and grow</div>
          <div style={{ color: "#cfc6b4", fontSize: 30, marginTop: 24 }}>Holiday camps and coaching across West Yorkshire</div>
        </div>
      </div>
    ),
    size,
  );
}
