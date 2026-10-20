// Client-side color-based image splitter.
// Quantizes an image into K dominant color clusters using k-means on a
// downsampled sample, then assigns every full-resolution pixel to its
// nearest cluster and renders one transparent PNG per cluster.
//
// Returns a list of layers — each one a same-size transparent canvas
// containing only that color group's pixels. Drop these into Fabric as
// individual images and the user can drag / hide / delete each part
// independently, Canva-style.

export type ColorLayer = {
  /** Hex color of the cluster centroid. */
  color: string;
  /** Transparent PNG data URL, same dimensions as the source image. */
  dataUrl: string;
  /** Approximate pixel coverage (0-1) for sorting / labeling. */
  coverage: number;
  /** Number of pixels assigned to this cluster. */
  pixels: number;
};

export type SplitOptions = {
  /** Number of clusters (color layers) to produce. Default 6. */
  k?: number;
  /** Max sample dimension for clustering (perf). Default 240. */
  sampleSize?: number;
  /** Alpha threshold (0-255) — pixels below this are skipped. Default 8. */
  alphaThreshold?: number;
  /** K-means iterations. Default 8. */
  iterations?: number;
};

type RGB = [number, number, number];

const toHex = (n: number) => n.toString(16).padStart(2, "0");
const rgbToHex = ([r, g, b]: RGB) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampleCanvas(img: HTMLImageElement, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function kmeans(
  pixels: Uint8ClampedArray,
  k: number,
  iterations: number,
  alphaThreshold: number,
): RGB[] {
  // Collect opaque samples
  const samples: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < alphaThreshold) continue;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  if (samples.length === 0) return [];

  // k-means++ init
  const centroids: RGB[] = [];
  centroids.push(samples[Math.floor(Math.random() * samples.length)]);
  while (centroids.length < k) {
    const dists = samples.map((p) => {
      let best = Infinity;
      for (const c of centroids) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < best) best = d;
      }
      return best;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    centroids.push(samples[idx]);
  }

  // Lloyd iterations
  for (let it = 0; it < iterations; it++) {
    const sums = centroids.map(() => [0, 0, 0, 0]); // r,g,b,count
    for (const p of samples) {
      let best = 0,
        bestD = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i];
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const s = sums[best];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    for (let i = 0; i < centroids.length; i++) {
      const s = sums[i];
      if (s[3] > 0)
        centroids[i] = [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])];
    }
  }
  return centroids;
}

/** Split an image into K color layers. Each layer is a transparent PNG. */
export async function splitImageByColor(
  src: string,
  opts: SplitOptions = {},
): Promise<ColorLayer[]> {
  const k = Math.max(2, Math.min(16, opts.k ?? 6));
  const sampleSize = opts.sampleSize ?? 240;
  const alphaThreshold = opts.alphaThreshold ?? 8;
  const iterations = opts.iterations ?? 8;

  const img = await loadImage(src);
  const sample = sampleCanvas(img, sampleSize);
  const centroids = kmeans(sample.data, k, iterations, alphaThreshold);
  if (centroids.length === 0) return [];

  // Full-resolution pass
  const fullW = img.width,
    fullH = img.height;
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = fullW;
  fullCanvas.height = fullH;
  const fctx = fullCanvas.getContext("2d", { willReadFrequently: true })!;
  fctx.drawImage(img, 0, 0);
  const full = fctx.getImageData(0, 0, fullW, fullH);
  const data = full.data;

  // One output buffer per cluster
  const layerBufs = centroids.map(() => new Uint8ClampedArray(data.length));
  const counts = new Array(centroids.length).fill(0);
  let totalOpaque = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < alphaThreshold) continue;
    totalOpaque++;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    let best = 0,
      bestD = Infinity;
    for (let j = 0; j < centroids.length; j++) {
      const c = centroids[j];
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    const buf = layerBufs[best];
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
    counts[best]++;
  }

  // Render each cluster to a PNG
  const out: ColorLayer[] = [];
  for (let j = 0; j < centroids.length; j++) {
    if (counts[j] === 0) continue;
    const c = document.createElement("canvas");
    c.width = fullW;
    c.height = fullH;
    const cctx = c.getContext("2d")!;
    const id = new ImageData(layerBufs[j], fullW, fullH);
    cctx.putImageData(id, 0, 0);
    out.push({
      color: rgbToHex(centroids[j]),
      dataUrl: c.toDataURL("image/png"),
      coverage: totalOpaque > 0 ? counts[j] / totalOpaque : 0,
      pixels: counts[j],
    });
  }
  // Largest coverage first → user sees the background layer at the bottom of the list.
  out.sort((a, b) => b.coverage - a.coverage);
  return out;
}
