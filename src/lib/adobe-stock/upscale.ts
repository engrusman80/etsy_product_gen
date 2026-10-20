// Client-side upscaler — takes a generated PNG (usually 1024x1024 ≈ 1 MP),
// upscales it to a target megapixel count (Adobe Stock requires ≥ 4 MP),
// and exports as either JPEG, PNG, or transparent PNG.
//
// Uses native browser bicubic-ish resampling (imageSmoothingQuality: "high")
// in a chain of 2x steps for quality.

export type Format = "jpeg" | "png";

export type UpscaleOptions = {
  /** Target megapixels (e.g. 4, 8, 16). Adobe min = 4, max = 100. */
  targetMp: number;
  format: Format;
  /** JPEG quality 0..1 (default 0.95). */
  quality?: number;
  /** Preserve transparency for PNG output. Default true. */
  transparent?: boolean;
  /** Force output aspect ratio (W/H). When set, the source is center-cropped to this aspect before upscaling. */
  aspect?: number;
  /** Apply a light unsharp mask to counter upscale softness. Default true. */
  sharpen?: boolean;
  /** For JPEG: iteratively adjust quality so the final file lands in [minBytes, maxBytes]. */
  minBytes?: number;
  maxBytes?: number;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

/** Returns a Blob in the requested format at >= targetMp resolution. */
export async function upscaleImage(
  sourceDataUrl: string,
  opts: UpscaleOptions,
): Promise<{ blob: Blob; width: number; height: number; mp: number }> {
  const img = await loadImage(sourceDataUrl);
  const srcAspect = img.width / img.height;
  const aspect = opts.aspect && opts.aspect > 0 ? opts.aspect : srcAspect;

  // Compute target dimensions that give ≥ targetMp while preserving aspect.
  const targetPixels = opts.targetMp * 1_000_000;
  let targetH = Math.sqrt(targetPixels / aspect);
  let targetW = targetH * aspect;
  targetW = Math.ceil(targetW);
  targetH = Math.ceil(targetH);


  // Cap at 100 MP per Adobe Stock max.
  const maxPixels = 100_000_000;
  if (targetW * targetH > maxPixels) {
    const scale = Math.sqrt(maxPixels / (targetW * targetH));
    targetW = Math.floor(targetW * scale);
    targetH = Math.floor(targetH * scale);
  }

  // Step-up by 2x to preserve sharpness.
  // Center-crop source to target aspect (no-op when aspect ≈ srcAspect).
  let cropW = img.width;
  let cropH = img.height;
  if (srcAspect > aspect) {
    cropW = Math.round(img.height * aspect);
  } else if (srcAspect < aspect) {
    cropH = Math.round(img.width / aspect);
  }
  const cropX = Math.floor((img.width - cropW) / 2);
  const cropY = Math.floor((img.height - cropH) / 2);

  let curW = cropW;
  let curH = cropH;
  let curCanvas: HTMLCanvasElement = document.createElement("canvas");
  curCanvas.width = curW;
  curCanvas.height = curH;
  curCanvas.getContext("2d")!.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, curW, curH);


  while (curW * 2 < targetW) {
    const next = document.createElement("canvas");
    next.width = curW * 2;
    next.height = curH * 2;
    const ctx = next.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(curCanvas, 0, 0, next.width, next.height);
    curCanvas = next;
    curW = next.width;
    curH = next.height;
  }

  // Final resize to exact target.
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const octx = out.getContext("2d")!;
  if (opts.format === "jpeg" || opts.transparent === false) {
    // JPEG has no alpha — fill white background to avoid black where transparent.
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, targetW, targetH);
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(curCanvas, 0, 0, targetW, targetH);

  // Light unsharp mask so upscaled pixels look crisp at 100% zoom (opt-out via sharpen:false).
  if (opts.sharpen !== false) {
    try { applyUnsharpMask(out, 0.35); } catch { /* non-fatal */ }
  }

  const mime = opts.format === "jpeg" ? "image/jpeg" : "image/png";
  const baseQuality = opts.quality ?? 0.95;

  const toBlob = (q?: number) =>
    new Promise<Blob>((res, rej) =>
      out.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), mime, q),
    );

  let blob: Blob;
  if (opts.format === "jpeg" && (opts.minBytes || opts.maxBytes)) {
    // Binary-search JPEG quality to land in [minBytes, maxBytes]
    const min = opts.minBytes ?? 0;
    const max = opts.maxBytes ?? Number.POSITIVE_INFINITY;
    let lo = 0.6, hi = 1.0, best = await toBlob(baseQuality);
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const b = await toBlob(mid);
      if (b.size > max) hi = mid;
      else if (b.size < min) lo = mid;
      else { best = b; break; }
      best = b;
    }
    blob = best;
  } else {
    blob = await toBlob(opts.format === "jpeg" ? baseQuality : undefined);
  }

  return { blob, width: targetW, height: targetH, mp: (targetW * targetH) / 1_000_000 };
}

/** Simple in-place unsharp mask on a canvas — amount 0..1 (e.g. 0.35 subtle, 0.8 strong). */
function applyUnsharpMask(canvas: HTMLCanvasElement, amount: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  // Guard: skip for huge canvases where the ImageData allocation would be enormous (> ~64 MP).
  if (w * h > 64_000_000) return;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data, d = dst.data;
  // 3x3 blur weights (approximate gaussian)
  const kw = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kwSum = 16;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let acc = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            acc += s[((y + dy) * w + (x + dx)) * 4 + c] * kw[ki++];
          }
        }
        const blur = acc / kwSum;
        const orig = s[i + c];
        const sharpened = orig + (orig - blur) * amount;
        d[i + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
      }
      d[i + 3] = s[i + 3];
    }
  }
  // Copy border rows/cols unchanged
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i+1] = s[i+1]; d[i+2] = s[i+2]; d[i+3] = s[i+3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i+1] = s[i+1]; d[i+2] = s[i+2]; d[i+3] = s[i+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
