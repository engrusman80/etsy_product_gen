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

// ---- Vector tracing (SVG / DXF cut files) ---------------------------------

type TraceSegment = {
  type: "L" | "Q";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3?: number;
  y3?: number;
};
type TracePath = { segments: TraceSegment[]; isholepath: boolean; holechildren: number[] };
type TraceData = {
  layers: TracePath[][];
  palette: { r: number; g: number; b: number; a: number }[];
  width: number;
  height: number;
};

/**
 * Traces the (transparent) design into real vector shapes for Cricut/Silhouette users.
 * The raster is downscaled first: tracing is CPU-bound and runs on the main thread.
 * Returns an SVG sized in inches at PRINT_DPI and a DXF of the same outlines.
 */
export async function traceVector(
  b64: string,
  printPx: number,
  opts: { maxSide?: number; colors?: number } = {},
): Promise<{ svg: Blob; dxf: Blob }> {
  const { default: ImageTracer } = await import("imagetracerjs");
  const img = await loadB64(b64);
  const maxSide = opts.maxSide ?? 768;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const imgd = ctx.getImageData(0, 0, w, h);
  // Cut files need hard edges: binarize alpha, and give every transparent pixel the same
  // colour so it maps onto the palette's transparent entry instead of a real colour.
  const d = imgd.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    else d[i + 3] = 255;
  }

  const traceOpts = {
    pal: [{ r: 0, g: 0, b: 0, a: 0 }, ...opaquePalette(d, (opts.colors ?? 16) - 1)],
    colorquantcycles: 2,
    pathomit: 8,
    ltres: 1,
    qtres: 1,
    blurradius: 0,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 2,
    viewbox: true,
    scale: 1,
  };
  const td = ImageTracer.imagedataToTracedata(imgd, traceOpts) as TraceData;
  // Drop transparent colour layers so the background is not traced as a shape.
  td.layers = td.layers.map((layer, i) => (td.palette[i].a < 128 ? [] : layer));

  const inchesW = ((printPx / Math.max(w, h)) * w) / PRINT_DPI;
  const inchesH = ((printPx / Math.max(w, h)) * h) / PRINT_DPI;
  const svgStr = (ImageTracer.getsvgstring(td, traceOpts) as string).replace(
    /^<svg /,
    `<svg width="${inchesW.toFixed(3)}in" height="${inchesH.toFixed(3)}in" `,
  );
  const svg = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svgStr}`], {
    type: "image/svg+xml",
  });

  // DXF: one closed LWPOLYLINE per traced outline, in inches with the Y axis pointing up.
  const k = inchesW / w;
  const ents: string[] = [];
  td.layers.forEach((layer) => {
    for (const path of layer) {
      const pts: [number, number][] = [];
      for (const s of path.segments) {
        if (!pts.length) pts.push([s.x1, s.y1]);
        if (s.type === "Q" && s.x3 !== undefined && s.y3 !== undefined) {
          for (let t = 0.25; t <= 1.0001; t += 0.25) {
            const u = 1 - t;
            pts.push([
              u * u * s.x1 + 2 * u * t * s.x2 + t * t * s.x3,
              u * u * s.y1 + 2 * u * t * s.y2 + t * t * s.y3!,
            ]);
          }
        } else {
          pts.push([s.x2, s.y2]);
        }
      }
      if (pts.length < 3) continue;
      const coords = pts
        .map(([x, y]) => `10\n${(x * k).toFixed(4)}\n20\n${((h - y) * k).toFixed(4)}`)
        .join("\n");
      ents.push(`0\nLWPOLYLINE\n8\n0\n90\n${pts.length}\n70\n1\n${coords}`);
    }
  });
  const dxfStr = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n1\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${ents.join("\n")}\n0\nENDSEC\n0\nEOF\n`;
  const dxf = new Blob([dxfStr], { type: "application/dxf" });
  return { svg, dxf };
}

/** Small deterministic k-means over opaque pixels (farthest-point seeding, so dark details survive). */
function opaquePalette(
  d: Uint8ClampedArray,
  k: number,
): { r: number; g: number; b: number; a: number }[] {
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(d.length / 4 / 40000));
  for (let p = 0; p < d.length / 4; p += step) {
    const i = p * 4;
    if (d[i + 3] === 255) samples.push([d[i], d[i + 1], d[i + 2]]);
  }
  if (!samples.length) return [{ r: 0, g: 0, b: 0, a: 255 }];
  const dist = (x: number[], y: number[]) =>
    Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
  const centers: number[][] = [samples[0]];
  const best = samples.map((s) => dist(s, centers[0]));
  while (centers.length < Math.min(k, samples.length)) {
    let far = 0;
    for (let i = 1; i < samples.length; i++) if (best[i] > best[far]) far = i;
    if (best[far] < 12) break; // remaining colours are near-duplicates
    centers.push(samples[far]);
    for (let i = 0; i < samples.length; i++)
      best[i] = Math.min(best[i], dist(samples[i], samples[far]));
  }
  for (let iter = 0; iter < 6; iter++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      let ci = 0;
      for (let c = 1; c < centers.length; c++)
        if (dist(s, centers[c]) < dist(s, centers[ci])) ci = c;
      acc[ci][0] += s[0];
      acc[ci][1] += s[1];
      acc[ci][2] += s[2];
      acc[ci][3]++;
    }
    acc.forEach((a, c) => {
      if (a[3]) centers[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  return centers.map(([r, g, b]) => ({
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: 255,
  }));
}
