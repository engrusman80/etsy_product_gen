import { withDpi } from "@/lib/print-export";

export type ImageEdits = {
  include: boolean;
  filename: string;
  brightness: number; // 0-200 (100 = none)
  contrast: number; // 0-200
  saturate: number; // 0-200
  cropRatio: "original" | "1:1" | "4:5" | "16:9" | "9:16";
  zoom: number; // 1 - 3
  offsetX: number; // -1 .. 1 (pan as fraction of half-image)
  offsetY: number;
  bgColor: string; // "" = transparent
  frameColor: string; // "" = none
  frameWidth: number; // px in output
  bannerTop: string;
  bannerBottom: string;
  bannerColor: string; // hex
  bannerTextColor: string;
  bannerHeightPct: number; // 0-25
  bannerFontPx: number; // output px (auto-scaled)
};

export const DEFAULT_EDITS: ImageEdits = {
  include: true,
  filename: "",
  brightness: 100,
  contrast: 100,
  saturate: 100,
  cropRatio: "original",
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  bgColor: "",
  frameColor: "",
  frameWidth: 0,
  bannerTop: "",
  bannerBottom: "",
  bannerColor: "#2f3d4a",
  bannerTextColor: "#ffffff",
  bannerHeightPct: 10,
  bannerFontPx: 56,
};

export function loadImg(b64OrUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src =
      b64OrUrl.startsWith("data:") || b64OrUrl.startsWith("http")
        ? b64OrUrl
        : `data:image/png;base64,${b64OrUrl}`;
  });
}

function ratioWH(r: ImageEdits["cropRatio"], srcW: number, srcH: number): [number, number] {
  if (r === "original") return [srcW, srcH];
  const [a, b] = r.split(":").map(Number);
  return [a, b];
}

/**
 * Render edits onto a canvas at the chosen output size.
 * Returns a square-or-ratio canvas with all edits baked in.
 */
export async function bakeEdits(
  srcB64: string,
  edits: ImageEdits,
  outputLong = 1588,
  outputMime: "image/jpeg" | "image/png" = "image/jpeg",
  jpegQuality = 0.95,
): Promise<Blob> {
  const img = await loadImg(srcB64);
  const [rw, rh] = ratioWH(edits.cropRatio, img.width, img.height);
  // Output dimensions preserving long edge
  let outW: number, outH: number;
  if (rw >= rh) {
    outW = outputLong;
    outH = Math.round((outputLong * rh) / rw);
  } else {
    outH = outputLong;
    outW = Math.round((outputLong * rw) / rh);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Background fill
  if (edits.bgColor) {
    ctx.fillStyle = edits.bgColor;
  } else if (outputMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }
  if (edits.bgColor || outputMime === "image/jpeg") ctx.fillRect(0, 0, outW, outH);

  // Determine source crop window for the chosen ratio + zoom + pan
  const srcAR = img.width / img.height;
  const outAR = outW / outH;
  let cropW: number, cropH: number;
  if (srcAR > outAR) {
    cropH = img.height / edits.zoom;
    cropW = cropH * outAR;
  } else {
    cropW = img.width / edits.zoom;
    cropH = cropW / outAR;
  }
  const maxOffX = (img.width - cropW) / 2;
  const maxOffY = (img.height - cropH) / 2;
  const cx = img.width / 2 + edits.offsetX * maxOffX;
  const cy = img.height / 2 + edits.offsetY * maxOffY;
  const sx = Math.max(0, Math.min(img.width - cropW, cx - cropW / 2));
  const sy = Math.max(0, Math.min(img.height - cropH, cy - cropH / 2));

  // Apply CSS filter for color tuning + draw with high-quality stepped resampling
  ctx.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturate}%)`;
  drawImageHQ(ctx, img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  ctx.filter = "none";
  // Mild unsharp mask to counter resample softness when scaling up
  if (outW > cropW || outH > cropH) {
    applyUnsharp(ctx, outW, outH);
  }

  // Banners (drawn over the image, so they don't get tinted by filter)
  const bannerH = Math.round((edits.bannerHeightPct / 100) * outH);
  if (edits.bannerTop) {
    ctx.fillStyle = edits.bannerColor;
    ctx.fillRect(0, 0, outW, bannerH);
    drawBannerText(
      ctx,
      edits.bannerTop,
      outW / 2,
      bannerH / 2,
      outW * 0.92,
      bannerH * 0.7,
      edits.bannerTextColor,
      edits.bannerFontPx,
    );
  }
  if (edits.bannerBottom) {
    ctx.fillStyle = edits.bannerColor;
    ctx.fillRect(0, outH - bannerH, outW, bannerH);
    drawBannerText(
      ctx,
      edits.bannerBottom,
      outW / 2,
      outH - bannerH / 2,
      outW * 0.92,
      bannerH * 0.7,
      edits.bannerTextColor,
      edits.bannerFontPx,
    );
  }

  // Frame (drawn last, inside the canvas)
  if (edits.frameColor && edits.frameWidth > 0) {
    ctx.strokeStyle = edits.frameColor;
    ctx.lineWidth = edits.frameWidth;
    ctx.strokeRect(
      edits.frameWidth / 2,
      edits.frameWidth / 2,
      outW - edits.frameWidth,
      outH - edits.frameWidth,
    );
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      outputMime,
      outputMime === "image/jpeg" ? jpegQuality : undefined,
    ),
  );
  return withDpi(blob);
}

function drawBannerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  color: string,
  basePx: number,
) {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = basePx;
  // shrink to fit
  for (let i = 0; i < 30; i++) {
    ctx.font = `700 ${size}px Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
    const w = ctx.measureText(text).width;
    if (w <= maxW && size <= maxH) break;
    size -= 2;
    if (size < 8) break;
  }
  ctx.fillText(text, cx, cy);
}

export function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9-_.]/gi, "_").slice(0, 80);
}

/**
 * High-quality stepped resampling. When upscaling, scale in successive ~2x
 * passes to preserve detail; when downscaling, halve until target is near.
 * Source crop (sx,sy,sw,sh) is drawn into the destination rect on `ctx`.
 */
export function drawImageHQ(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  // Cheap path: dimensions roughly equal
  const ratioW = dw / sw,
    ratioH = dh / sh;
  if (ratioW > 0.5 && ratioW < 2 && ratioH > 0.5 && ratioH < 2) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }

  // Stepped resize via off-screen canvas
  let curW = Math.max(1, Math.round(sw));
  let curH = Math.max(1, Math.round(sh));
  let cur: HTMLCanvasElement | OffscreenCanvas;
  const c0 = document.createElement("canvas");
  c0.width = curW;
  c0.height = curH;
  const cx0 = c0.getContext("2d")!;
  cx0.imageSmoothingEnabled = true;
  cx0.imageSmoothingQuality = "high";
  cx0.drawImage(img, sx, sy, sw, sh, 0, 0, curW, curH);
  cur = c0;

  // Iteratively step toward target
  const stepTo = (nw: number, nh: number) => {
    const next = document.createElement("canvas");
    next.width = nw;
    next.height = nh;
    const nx = next.getContext("2d")!;
    nx.imageSmoothingEnabled = true;
    nx.imageSmoothingQuality = "high";
    nx.drawImage(cur as CanvasImageSource, 0, 0, curW, curH, 0, 0, nw, nh);
    cur = next;
    curW = nw;
    curH = nh;
  };
  // Upscale in 1.5x steps
  while (curW * 1.5 < dw && curH * 1.5 < dh) {
    stepTo(Math.round(curW * 1.5), Math.round(curH * 1.5));
  }
  // Downscale in 0.5x steps
  while (curW * 0.5 > dw && curH * 0.5 > dh) {
    stepTo(Math.round(curW * 0.5), Math.round(curH * 0.5));
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur as CanvasImageSource, 0, 0, curW, curH, dx, dy, dw, dh);
}

let __sharpenInjected = false;
function ensureSharpenFilter() {
  if (__sharpenInjected || typeof document === "undefined") return;
  if (document.getElementById("__hq_sharpen_svg")) {
    __sharpenInjected = true;
    return;
  }
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("id", "__hq_sharpen_svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.pointerEvents = "none";
  svg.innerHTML = `<filter id="__hq_sharpen" x="0" y="0" width="100%" height="100%">
    <feConvolveMatrix order="3" preserveAlpha="true"
      kernelMatrix="0 -0.4 0  -0.4 2.6 -0.4  0 -0.4 0" />
  </filter>`;
  document.body.appendChild(svg);
  __sharpenInjected = true;
}

/** Apply a mild unsharp mask to the entire canvas in-place. */
export function applyUnsharp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    ensureSharpenFilter();
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "url(#__hq_sharpen)";
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = "none";
    ctx.restore();
  } catch {
    // ignore — sharpening is a nice-to-have
  }
}
