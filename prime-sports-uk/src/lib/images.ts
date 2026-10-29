import "server-only";
import sharp from "sharp";

/**
 * Prepares a school logo for the black circle on camp cards:
 * removes a plain white or flat background (flood fill from the edges, so white inside the
 * logo is kept), trims the empty space, then centres it on a transparent square.
 */
export async function processLogo(input: Buffer, size = 512): Promise<Buffer> {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);

  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const opaque = border.filter((i) => px[i * 4 + 3] > 200);

  // Only treat the edge colour as background if the edge is mostly one flat colour.
  if (opaque.length > border.length * 0.5) {
    const avg = [0, 1, 2].map((c) => opaque.reduce((s, i) => s + px[i * 4 + c], 0) / opaque.length);
    const spread = opaque.reduce((s, i) => s + dist(px, i, avg), 0) / opaque.length;
    if (spread < 18) {
      const tol = 42;
      const seen = new Uint8Array(w * h);
      const stack = opaque.filter((i) => dist(px, i, avg) < tol);
      for (const i of stack) seen[i] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        const d = dist(px, i, avg);
        // Soft edge: fully clear near the background colour, fade out towards the tolerance.
        px[i * 4 + 3] = Math.min(px[i * 4 + 3], Math.round(Math.max(0, (d - tol * 0.5) / (tol * 0.5)) * 255));
        const x = i % w;
        const y = (i / w) | 0;
        for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (n >= 0 && !seen[n] && dist(px, n, avg) < tol) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
  }

  const cleared = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  let trimmed: Buffer;
  try {
    trimmed = await sharp(cleared).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 }).png().toBuffer();
  } catch {
    trimmed = cleared; // nothing to trim
  }
  const inner = Math.round(size * 0.86);
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(fitted).metadata();
  const left = Math.round((size - (meta.width ?? inner)) / 2);
  const top = Math.round((size - (meta.height ?? inner)) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function dist(px: Uint8ClampedArray, i: number, c: number[]): number {
  const r = px[i * 4] - c[0];
  const g = px[i * 4 + 1] - c[1];
  const b = px[i * 4 + 2] - c[2];
  return Math.sqrt(r * r + g * g + b * b);
}

/** Photos: fix orientation, strip location data, cap the size and convert to WebP. */
export async function processPhoto(input: Buffer, maxWidth = 1600): Promise<Buffer> {
  return sharp(input).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}
