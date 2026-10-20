// Layered PSD export. Produces a real .psd that opens in Photoshop / Photopea
// with each item as an independently editable layer.
//
// Two entry points:
//   - exportObjectsAsPsd(): each canvas object (text / shape / image) becomes
//     its own PSD layer at its real position. Best when the user built the
//     design in the editor.
//   - exportColorLayersAsPsd(): splits a raster image into K dominant-color
//     layers (uses splitImageByColor) and writes each as a PSD layer. Best for
//     AI-generated flat artwork the user wants to recolor / rearrange.

import { writePsd, type Psd, type Layer } from "ag-psd";
import { splitImageByColor } from "./color-split";

type FCanvas = import("fabric").Canvas;
type FObject = import("fabric").FabricObject;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function dataUrlToCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

/**
 * Render a single Fabric object onto a transparent canvas the size of the
 * full design, at its exact position — so it can be dropped into PSD as a
 * pixel-perfect layer.
 */
async function renderObjectToFullCanvas(
  fabricMod: typeof import("fabric"),
  obj: FObject,
  fullW: number,
  fullH: number,
): Promise<HTMLCanvasElement> {
  // Use Fabric's StaticCanvas to render this one object into a transparent
  // canvas at the full design size. We clone the object so we don't mutate
  // the user's canvas.
  const tmp = new fabricMod.StaticCanvas(undefined, {
    width: fullW,
    height: fullH,
    enableRetinaScaling: false,
    backgroundColor: undefined,
  });
  const cloned: FObject = await new Promise((resolve) => {
    obj.clone().then(resolve);
  });
  tmp.add(cloned);
  tmp.renderAll();
  const out = document.createElement("canvas");
  out.width = fullW;
  out.height = fullH;
  out.getContext("2d")!.drawImage(tmp.lowerCanvasEl, 0, 0);
  tmp.dispose();
  return out;
}

function layerName(obj: FObject, idx: number): string {
  const t = obj.type ?? "object";
  // @ts-expect-error fabric text property
  if (t === "i-text" || t === "text" || t === "textbox")
    return `Text — ${(obj.text ?? "").toString().slice(0, 24) || "text"}`;
  if (t === "image") return `Image ${idx + 1}`;
  if (t === "rect") return `Rectangle ${idx + 1}`;
  if (t === "circle") return `Circle ${idx + 1}`;
  if (t === "polygon") return `Polygon ${idx + 1}`;
  if (t === "path") return `Drawing ${idx + 1}`;
  return `${t} ${idx + 1}`;
}

/**
 * Export every object on the canvas as a separate PSD layer.
 * Bottom-most object = bottom PSD layer. Background fill becomes its own layer.
 */
export async function exportObjectsAsPsd(opts: {
  canvas: FCanvas;
  width: number;
  height: number;
  backgroundColor?: string;
  filename?: string;
}) {
  const { canvas, width, height, backgroundColor, filename = "design.psd" } = opts;
  const fabricMod = await import("fabric");

  // Snapshot zoom & restore at end so the user's view isn't disturbed.
  const prevZoom = canvas.getZoom();
  canvas.setZoom(1);
  canvas.setDimensions({ width, height });

  const layers: Layer[] = [];

  // Background layer
  if (backgroundColor) {
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bctx = bg.getContext("2d")!;
    bctx.fillStyle = backgroundColor;
    bctx.fillRect(0, 0, width, height);
    layers.push({ name: "Background", canvas: bg, left: 0, top: 0 });
  }

  const objects = canvas.getObjects();
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj.visible) continue;
    try {
      const c = await renderObjectToFullCanvas(fabricMod, obj, width, height);
      layers.push({ name: layerName(obj, i), canvas: c, left: 0, top: 0 });
    } catch (e) {
      console.warn("[psd-export] skipped layer", i, e);
    }
  }

  // Composite preview = the full canvas
  const composite = document.createElement("canvas");
  composite.width = width;
  composite.height = height;
  composite.getContext("2d")!.drawImage(canvas.lowerCanvasEl, 0, 0);

  const psd: Psd = {
    width,
    height,
    canvas: composite,
    children: layers,
  };

  const buf = writePsd(psd);
  downloadBlob(new Blob([buf], { type: "image/vnd.adobe.photoshop" }), filename);

  // Restore view
  canvas.setZoom(prevZoom);
  canvas.setDimensions({ width: width * prevZoom, height: height * prevZoom });
}

/**
 * Export a raster image as a layered PSD where each layer holds one
 * dominant color cluster (uses splitImageByColor). Great for AI artwork.
 */
export async function exportColorLayersAsPsd(opts: {
  imageDataUrl: string;
  k?: number;
  backgroundColor?: string;
  filename?: string;
}) {
  const { imageDataUrl, k = 6, backgroundColor, filename = "design-color-layers.psd" } = opts;
  const parts = await splitImageByColor(imageDataUrl, { k });
  if (parts.length === 0) throw new Error("No color layers found");

  const composite = await dataUrlToCanvas(imageDataUrl);
  const width = composite.width;
  const height = composite.height;

  const layers: Layer[] = [];
  if (backgroundColor) {
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bctx = bg.getContext("2d")!;
    bctx.fillStyle = backgroundColor;
    bctx.fillRect(0, 0, width, height);
    layers.push({ name: "Background", canvas: bg, left: 0, top: 0 });
  }

  for (let i = 0; i < parts.length; i++) {
    const c = await dataUrlToCanvas(parts[i].dataUrl);
    const pct = Math.round(parts[i].coverage * 100);
    layers.push({
      name: `${parts[i].color}  (${pct}%)`,
      canvas: c,
      left: 0,
      top: 0,
    });
  }

  const psd: Psd = { width, height, canvas: composite, children: layers };
  const buf = writePsd(psd);
  downloadBlob(new Blob([buf], { type: "image/vnd.adobe.photoshop" }), filename);
}
