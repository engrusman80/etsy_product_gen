// Client-side helpers for print-ready Etsy digital files:
//  - removeWhiteBackground: free fallback when remove.bg is unavailable (designs are
//    generated on a flat white background, so a border flood-fill cuts them out cleanly).
//  - withDpi: stamps PNG/JPEG files with a DPI so they open at the right print size.

export const PRINT_DPI = 300;

function loadB64(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
  });
}

/**
 * Makes the near-white background connected to the image border transparent.
 * White areas fully enclosed by the artwork (e.g. eyes, highlights) are kept.
 * Edge pixels get partial alpha so the cut-out does not look jagged.
 * Returns base64 PNG (no data: prefix).
 */
export async function removeWhiteBackground(b64: string, tolerance = 28): Promise<string> {
  const img = await loadB64(b64);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Distance from pure white, 0 (white) .. 765 (black).
  const dist = (i: number) => 765 - (px[i] + px[i + 1] + px[i + 2]);
  const hard = tolerance * 3; // fully background below this
  const soft = hard * 2.5; // partially transparent up to this

  const bg = new Uint8Array(w * h); // 1 = background reached by flood fill
  const stack: number[] = [];
  const push = (p: number) => {
    if (bg[p]) return;
    if (px[p * 4 + 3] === 0 || dist(p * 4) <= hard) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }

  // Nothing to remove (e.g. full-bleed artwork): return the original untouched.
  let removed = 0;
  for (let p = 0; p < bg.length; p++) removed += bg[p];
  if (removed < w * h * 0.02) return b64.replace(/^data:image\/\w+;base64,/, "");

  for (let p = 0; p < bg.length; p++) {
    const i = p * 4;
    if (bg[p]) {
      px[i + 3] = 0;
      continue;
    }
    // Anti-alias pixels that touch the removed background.
    const x = p % w;
    const touches =
      (x > 0 && bg[p - 1]) ||
      (x < w - 1 && bg[p + 1]) ||
      (p >= w && bg[p - w]) ||
      (p < w * (h - 1) && bg[p + w]);
    if (!touches) continue;
    const d = dist(i);
    if (d < soft) {
      const a = (d - hard) / (soft - hard);
      px[i + 3] = Math.round(px[i + 3] * Math.max(0, Math.min(1, a)));
      // Un-premultiply the white fringe so edges don't glow on dark backgrounds.
      if (a > 0.05) {
        for (let k = 0; k < 3; k++) {
          px[i + k] = Math.max(0, Math.min(255, Math.round((px[i + k] - 255 * (1 - a)) / a)));
        }
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/png").split(",")[1];
}

// ---- DPI metadata --------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngWithDpi(buf: Uint8Array, dpi: number): Uint8Array {
  // Signature (8) + IHDR chunk (4 len + 4 type + 13 data + 4 crc) = 33 bytes.
  if (buf.length < 33 || buf[12] !== 0x49 || buf[13] !== 0x48) return buf;
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Drop any existing pHYs chunk, then insert ours right after IHDR.
  const parts: Uint8Array[] = [buf.subarray(0, 33), chunk];
  let off = 33;
  while (off + 8 <= buf.length) {
    const len = new DataView(buf.buffer, buf.byteOffset + off).getUint32(0);
    const end = off + 12 + len;
    const isPhys =
      buf[off + 4] === 0x70 &&
      buf[off + 5] === 0x48 &&
      buf[off + 6] === 0x59 &&
      buf[off + 7] === 0x73;
    if (!isPhys) parts.push(buf.subarray(off, end));
    off = end;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function jpegWithDpi(buf: Uint8Array, dpi: number): Uint8Array {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const isJfif =
    buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46 && buf[8] === 0x49;
  if (isJfif) {
    const out = buf.slice();
    out[13] = 1; // units: dots per inch
    out[14] = dpi >> 8;
    out[15] = dpi & 0xff;
    out[16] = dpi >> 8;
    out[17] = dpi & 0xff;
    return out;
  }
  const app0 = new Uint8Array([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    dpi >> 8,
    dpi & 0xff,
    dpi >> 8,
    dpi & 0xff,
    0x00,
    0x00,
  ]);
  const out = new Uint8Array(buf.length + app0.length);
  out.set(buf.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(buf.subarray(2), 2 + app0.length);
  return out;
}

/** Returns the same PNG/JPEG with DPI metadata set (other types pass through). */
export async function withDpi(blob: Blob, dpi = PRINT_DPI): Promise<Blob> {
  if (blob.type !== "image/png" && blob.type !== "image/jpeg") return blob;
  const buf = new Uint8Array(await blob.arrayBuffer());
  const out = blob.type === "image/png" ? pngWithDpi(buf, dpi) : jpegWithDpi(buf, dpi);
  return new Blob([out as Uint8Array<ArrayBuffer>], { type: blob.type });
}
