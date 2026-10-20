import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  Moon,
  Sun,
  Sparkles,
  Download,
  Loader2,
  Store,
  Wand2,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Film,
  X,
  Plus,
  Pencil,
  EyeOff,
  TrendingUp,
  Share2,
  Facebook,
  Palette,
  Upload,
} from "lucide-react";
import { normalizeSocial, pinterestShareUrl, facebookShareUrl } from "@/lib/social";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTheme } from "@/hooks/use-theme";
import { ImageEditor } from "@/components/ImageEditor";
import {
  bakeEdits,
  DEFAULT_EDITS,
  drawImageHQ,
  applyUnsharp,
  safeFilename,
  type ImageEdits,
} from "@/lib/image-edits";
import { CostEstimateDialog } from "@/components/CostEstimateDialog";
import { estimateRun, type Estimate, type EstimateInput } from "@/lib/cost-estimator";
import { CrochetStudio } from "@/components/CrochetStudio";
import { LandingPage } from "@/components/LandingPage";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import {
  PRINT_DPI,
  imageSize,
  reencodeB64,
  removeWhiteBackground,
  traceVector,
  withDpi,
} from "@/lib/print-export";
import { activeProvider, hasAiKey, keyFor, useSettings } from "@/lib/settings-store";
import {
  ETSY_FILE_MAX,
  TAXONOMY_WORDS,
  blobToB64,
  dueDailyItem,
  etsyCall,
  etsyConnected,
  loadQueue,
  markDaily,
  saveEtsyDraft,
  shopCheckDue,
  storeShopCheck,
  todayKey,
  type DailyItem,
  type DraftResult,
} from "@/lib/etsy/client";
import { checkShop, type ListingLike } from "@/lib/etsy/check";
import {
  DEFAULT_PRODUCT_TYPE,
  PRODUCT_TYPES,
  getProductType,
  type ProductTypeId,
} from "@/lib/product-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Product Ai Automation" },
      {
        name: "description",
        content:
          "Generate SEO-optimized digital product listings, transparent print-ready art, and realistic mockups in one click — ready for commercial use.",
      },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: "product" | "crochet"; daily?: string } => ({
    tab: s.tab === "product" || s.tab === "crochet" ? s.tab : undefined,
    daily: typeof s.daily === "string" ? s.daily : undefined,
  }),
  component: Index,
});

const MOCKUPS = [
  { id: "digital-download", label: "Digital Download Cover" },
  { id: "banner-top-bottom", label: "Banner Top + Bottom (same text)" },
  { id: "white-tshirt", label: "White T-Shirt" },
  { id: "black-tshirt", label: "Black T-Shirt" },
  { id: "hoodie", label: "Hoodie" },
  { id: "baseball-tee", label: "Baseball Tee" },
  { id: "baby-onesie", label: "Baby Onesie" },
  { id: "cap", label: "Baseball Cap" },
  { id: "apron", label: "Apron" },
  { id: "mug", label: "Ceramic Mug" },
  { id: "tote-bag", label: "Tote Bag" },
  { id: "wall-frame", label: "Wall Frame" },
  { id: "canvas-print", label: "Canvas Print" },
  { id: "metal-print", label: "Metal Print" },
  { id: "wood-sign", label: "Wood Sign" },
  { id: "pillow", label: "Throw Pillow" },
  { id: "blanket", label: "Fleece Blanket" },
  { id: "sticker", label: "Sticker" },
  { id: "phone-case", label: "Phone Case" },
  { id: "notebook-cover", label: "Notebook Cover" },
  { id: "greeting-card", label: "Greeting Card" },
  { id: "enamel-pin", label: "Enamel Pin" },
  { id: "coaster", label: "Coaster" },
  { id: "puzzle", label: "Jigsaw Puzzle" },
  { id: "tumbler", label: "20oz Skinny Tumbler" },
  { id: "sticker-sheet-mockup", label: "Sticker Sheet on Desk" },
  { id: "clipart-flatlay", label: "Clipart Craft Flat-lay" },
  { id: "gallery-wall", label: "Framed Print Above Console" },
  { id: "coloring-page-mockup", label: "Coloring Page with Pencils" },
  { id: "digital-paper-mockup", label: "Digital Paper Fan + Gift" },
  { id: "planner-mockup", label: "Planner in Binder" },
  { id: "ipad-planner", label: "Planner on iPad" },
  { id: "invitation-flatlay", label: "Invitation Flat-lay" },
  { id: "phone-screen", label: "Phone Lock Screen" },
];

const DEFAULT_SELECTED = new Set(getProductType(DEFAULT_PRODUCT_TYPE).mockups);

const DEFAULT_EXPORT_SIZE = 4096;
const RES = [{ label: "4096", size: DEFAULT_EXPORT_SIZE }];

type SEO = { title: string; description: string; tags: string[]; mature?: boolean };
type Mockup = { id: string; label: string; image: string };
type ProductItem = {
  seo: SEO;
  rawImage: string;
  transparentImage: string;
  mockups: Mockup[];
  productType: ProductTypeId;
};
type BatchProduct = {
  keyword: string;
  items: Array<ProductItem | null>;
  expectedVariations: number;
};

function generatedCount(items: Array<ProductItem | null>): number {
  return items.filter(Boolean).length;
}

function isBatchComplete(batch: BatchProduct[] | null): boolean {
  return !!batch?.length && batch.every((p) => generatedCount(p.items) >= p.expectedVariations);
}

function parseKeywords(s: string): string[] {
  const parts = s
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
    if (out.length >= 10) break;
  }
  return out;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product"
  );
}

type Shop = {
  shopName: string;
  instagram: string;
  pinterest: string;
  facebook: string;
  etsy: string;
  website: string;
  email: string;
};

const DEFAULT_SHOP: Shop = {
  shopName: "",
  instagram: "",
  pinterest: "",
  facebook: "",
  etsy: "",
  website: "",
  email: "",
};

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (nv: T) => {
    setV(nv);
    try {
      localStorage.setItem(key, JSON.stringify(nv));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}

async function loadImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob failed"))), type, quality),
  );
  // Stamp 300 DPI so files open at the intended print size (4096px ≈ 13.65in).
  return withDpi(blob);
}

/** Output size with `long` px on the longer edge, keeping the image's aspect ratio. */
function fitLong(img: { width: number; height: number }, long: number): [number, number] {
  if (img.width >= img.height) return [long, Math.round((long * img.height) / img.width)];
  return [Math.round((long * img.width) / img.height), long];
}

async function resizePng(b64: string, size: number, withBg: string | null): Promise<Blob> {
  const img = await loadImage(b64);
  const [w, h] = fitLong(img, size);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (withBg) {
    ctx.fillStyle = withBg;
    ctx.fillRect(0, 0, w, h);
  }
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, w, h);
  if (w > img.width) applyUnsharp(ctx, w, h);
  return canvasToBlob(c, withBg ? "image/jpeg" : "image/png", withBg ? 0.98 : undefined);
}

async function imageDataUrlAtSize(
  b64: string,
  size = DEFAULT_EXPORT_SIZE,
  mime: "image/png" | "image/jpeg" = "image/png",
): Promise<string> {
  const blob =
    mime === "image/png" ? await resizePng(b64, size, null) : await resizeJpegHQ(b64, size, 0.98);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function makePdf(b64: string, size = DEFAULT_EXPORT_SIZE): Promise<Blob> {
  const imageUrl = await imageDataUrlAtSize(b64, size, "image/png");
  // Page size in inches at print DPI, so the PDF prints at the same size as the PNG.
  const [pw, ph] = fitLong(await loadImage(b64), size);
  const w = pw / PRINT_DPI,
    h = ph / PRINT_DPI;
  const pdf = new jsPDF({ unit: "in", format: [w, h], orientation: w > h ? "l" : "p" });
  pdf.addImage(imageUrl, "PNG", 0, 0, w, h, undefined, "FAST");
  return pdf.output("blob");
}

/** Printable page PDF (US Letter or A4) with the artwork fitted inside a 0.25in margin. */
async function makePagePdf(b64: string, page: "letter" | "a4"): Promise<Blob> {
  const img = await loadImage(b64);
  const [pw, ph] = page === "letter" ? [8.5, 11] : [8.27, 11.69];
  const landscape = img.width > img.height;
  const [W, H] = landscape ? [ph, pw] : [pw, ph];
  const m = 0.25;
  const scale = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height);
  const w = img.width * scale,
    h = img.height * scale;
  const imageUrl = await imageDataUrlAtSize(
    b64,
    Math.round(Math.max(W, H) * PRINT_DPI),
    "image/jpeg",
  );
  const pdf = new jsPDF({ unit: "in", format: [pw, ph], orientation: landscape ? "l" : "p" });
  pdf.addImage(imageUrl, "JPEG", (W - w) / 2, (H - h) / 2, w, h, undefined, "FAST");
  return pdf.output("blob");
}

async function makeSvg(b64: string, size = DEFAULT_EXPORT_SIZE): Promise<Blob> {
  const [w, h] = fitLong(await loadImage(b64), size);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image href="data:image/png;base64,${b64}" width="${w}" height="${h}"/>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

async function resizeJpegHQ(
  b64: string,
  size: number,
  quality = 0.98,
  bg = "#ffffff",
): Promise<Blob> {
  const img = await loadImage(b64);
  const [w, h] = fitLong(img, size);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, w, h);
  if (w > img.width) applyUnsharp(ctx, w, h);
  return canvasToBlob(c, "image/jpeg", quality);
}

async function resizeJpegUnder(
  b64: string,
  size: number,
  maxBytes: number,
  bg = "#ffffff",
): Promise<Blob> {
  const img = await loadImage(b64);
  const [w, h] = fitLong(img, size);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, w, h);
  if (w > img.width) applyUnsharp(ctx, w, h);
  let lo = 0.5,
    hi = 0.98,
    best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const b = await canvasToBlob(c, "image/jpeg", q);
    if (b.size <= maxBytes) {
      best = b;
      lo = q;
    } else {
      hi = q;
    }
  }
  if (!best) best = await canvasToBlob(c, "image/jpeg", 0.5);
  return best;
}

async function makeEps(b64: string, long: number): Promise<Blob> {
  const [w, h] = fitLong(await loadImage(b64), long);
  const jpegBlob = await resizeJpegUnder(b64, long, 5_000_000, "#ffffff");
  const buf = new Uint8Array(await jpegBlob.arrayBuffer());
  let hex = "";
  for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16).padStart(2, "0");
  const wrapped = hex.match(/.{1,64}/g)!.join("\n");
  const eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${w} ${h}
%%EndComments
gsave
0 0 translate
${w} ${h} scale
/DeviceRGB setcolorspace
<<
  /ImageType 1
  /Width ${w}
  /Height ${h}
  /ImageMatrix [${w} 0 0 -${h} 0 ${h}]
  /DataSource currentfile /ASCIIHexDecode filter /DCTDecode filter
  /BitsPerComponent 8
  /Decode [0 1 0 1 0 1]
>> image
${wrapped}
>
grestore
showpage
%%EOF
`;
  return new Blob([eps], { type: "application/postscript" });
}

async function makeShowcaseVideo(b64: string, onProgress?: (p: number) => void): Promise<Blob> {
  const img = await loadImage(b64);
  const W = 1080,
    H = 1080,
    FPS = 30,
    SECONDS = 5;
  const totalFrames = FPS * SECONDS;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const stream = canvas.captureStream(FPS);
  const mimeCandidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const drawFrame = (t: number) => {
    // Etsy-style soft warm background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fafafa");
    g.addColorStop(1, "#efeae2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // subtle vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // Slow Ken-Burns zoom 1.0 → 1.12 with gentle rotate
    const ease = t * t * (3 - 2 * t); // smoothstep
    const scale = 1.0 + ease * 0.12;
    const rotate = (ease - 0.5) * 0.04; // ±0.02 rad
    const base = W * 0.72;
    const size = base * scale;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rotate);
    // soft shadow
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject((e as ErrorEvent).error ?? new Error("recorder error"));
    recorder.start(100);
    let frame = 0;
    const tick = () => {
      if (frame > totalFrames) {
        recorder.stop();
        return;
      }
      drawFrame(frame / totalFrames);
      onProgress?.(frame / totalFrames);
      frame++;
      setTimeout(tick, 1000 / FPS);
    };
    tick();
  });
}

function Index() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"product" | "crochet" | "home">(search.tab ?? "home");
  useEffect(() => {
    if (search.tab) setActiveTab(search.tab);
  }, [search.tab]);
  const { theme, toggle } = useTheme();
  const [settings] = useSettings();
  const [shop, setShop] = useLocal<Shop>("etsyforge:shop", DEFAULT_SHOP);

  const [idea, setIdea] = useState("");
  useEffect(() => {
    try {
      const seed = localStorage.getItem("etsyforge:seed");
      if (seed) {
        setIdea((prev) => (prev ? prev : seed));
        localStorage.removeItem("etsyforge:seed");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [shopOpen, setShopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const [seo, setSeo] = useState<SEO | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [transparentImage, setTransparentImage] = useState<string | null>(null);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [selectedMockups, setSelectedMockups] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [typePref, setTypePref] = useLocal<{ id: ProductTypeId }>("etsyforge:productType", {
    id: DEFAULT_PRODUCT_TYPE,
  });
  const productType = getProductType(typePref.id);
  // The type the current single result was generated with (the picker may change afterwards).
  const [resultType, setResultType] = useState<ProductTypeId>(DEFAULT_PRODUCT_TYPE);
  const [customMockups, setCustomMockups] = useState<string[]>([]);
  const [customMockupInput, setCustomMockupInput] = useState("");
  const [mockupPickerOpen, setMockupPickerOpen] = useState(false);
  const [customSizes, setCustomSizes] = useState<number[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [video, setVideo] = useState<{ blob: Blob; url: string; ext: string } | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);

  // Per-image edits map. Key = "mockup:<id>", "main:raw", "main:transparent".
  const [edits, setEdits] = useState<Record<string, ImageEdits>>({});
  const [editorOpen, setEditorOpen] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [variations, setVariations] = useState(1);
  const [uniqueness, setUniqueness] = useState<"subtle" | "balanced" | "bold" | "wild">("balanced");
  const [batch, setBatch] = useState<BatchProduct[] | null>(null);
  const [batchCursor, setBatchCursor] = useState<{ ki: number; vi: number } | null>(null);

  // Cost confirmation dialog
  const [costEstimate, setCostEstimate] = useState<Estimate | null>(null);
  const [costOpen, setCostOpen] = useState(false);

  // Each product type comes with its own sensible mockups.
  useEffect(() => {
    setSelectedMockups(new Set(getProductType(typePref.id).mockups));
  }, [typePref.id]);
  const costResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const skipCostRef = useRef(false);

  async function confirmCost(input: EstimateInput): Promise<boolean> {
    if (skipCostRef.current) return true;
    const est = estimateRun(input);
    if (est.totalCalls === 0) return true;
    setCostEstimate(est);
    setCostOpen(true);
    return await new Promise<boolean>((resolve) => {
      costResolveRef.current = resolve;
    });
  }
  function handleCostConfirm(remember: boolean) {
    if (remember) skipCostRef.current = true;
    setCostOpen(false);
    costResolveRef.current?.(true);
    costResolveRef.current = null;
  }
  function handleCostCancel() {
    setCostOpen(false);
    costResolveRef.current?.(false);
    costResolveRef.current = null;
  }

  const getEdits = (key: string, defaultName: string): ImageEdits =>
    edits[key] ?? { ...DEFAULT_EDITS, filename: defaultName };
  const setKeyEdits = (key: string, e: ImageEdits) => setEdits((prev) => ({ ...prev, [key]: e }));

  const allMockups = [
    ...MOCKUPS,
    ...customMockups.map((c) => ({ id: `custom:${c}`, label: c, custom: true as const })),
  ];
  const totalSelected = allMockups.filter((m) => selectedMockups.has(m.id)).length;
  const allResolutions = [...RES, ...customSizes.map((s) => ({ label: String(s), size: s }))];

  async function regenerateMockup(m: Mockup, tweak: string) {
    const okRun = await confirmCost({
      provider: activeProvider(settings),
      products: 0,
      variations: 1,
      mockupsPerVariation: 1,
      useRemoveBgApi: false,
    });
    if (!okRun) return;
    setRegenBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        image: transparentImage ? await mockupInput(transparentImage) : transparentImage,
        mockup: m.id,
        tweak,
        formats: getProductType(resultType).formats,
      };
      if (m.id.startsWith("custom:")) body.customPrompt = m.label;
      const r = await api<{ image: string }>("/api/generate-mockup", body);
      setMockups((list) => list.map((x) => (x.id === m.id ? { ...x, image: r.image } : x)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRegenBusy(false);
    }
  }

  // ---- Image Studio (Fabric.js full editor) ----------------------------
  // kind supports:
  //   "main:raw" | "main:transparent" | `mockup:${id}`
  //   `batch:${pi}:${vi}:raw` | `batch:${pi}:${vi}:transparent` | `batch:${pi}:${vi}:mockup:${id}`
  function openInStudio(kind: string, b64: string) {
    const key = `editor:${kind}:${Date.now()}`;
    try {
      // localStorage so the new tab can read it (sessionStorage is per-tab).
      localStorage.setItem(key, `data:image/png;base64,${b64}`);
    } catch {
      setErr("Image too large for editor local storage.");
      return;
    }
    const tag = encodeURIComponent(kind);
    const url = `/editor?key=${encodeURIComponent(key)}&back=/&tag=${tag}`;
    studioPending.current[key] = kind;
    window.open(url, "_blank", "noopener");
  }

  const studioPending = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("image-studio");
    const onMsg = (ev: MessageEvent<{ key: string; dataUrl: string }>) => {
      const kind = studioPending.current[ev.data.key];
      if (!kind) return;
      const b64 = ev.data.dataUrl.replace(/^data:image\/\w+;base64,/, "");
      if (kind === "main:raw") setRawImage(b64);
      else if (kind === "main:transparent") setTransparentImage(b64);
      else if (kind.startsWith("mockup:")) {
        const id = kind.slice("mockup:".length);
        setMockups((list) => list.map((m) => (m.id === id ? { ...m, image: b64 } : m)));
      } else if (kind.startsWith("batch:")) {
        // batch:pi:vi:raw | batch:pi:vi:transparent | batch:pi:vi:mockup:<id>
        const rest = kind.slice("batch:".length);
        const parts = rest.split(":");
        const pi = Number(parts[0]);
        const vi = Number(parts[1]);
        const sub = parts.slice(2).join(":"); // "raw" | "transparent" | "mockup:<id>"
        setBatch((prev) => {
          if (!prev) return prev;
          const next = prev.map((p) => ({ ...p, items: [...p.items] }));
          const item = next[pi]?.items[vi];
          if (!item) return prev;
          if (sub === "raw") next[pi].items[vi] = { ...item, rawImage: b64 };
          else if (sub === "transparent") next[pi].items[vi] = { ...item, transparentImage: b64 };
          else if (sub.startsWith("mockup:")) {
            const id = sub.slice("mockup:".length);
            next[pi].items[vi] = {
              ...item,
              mockups: item.mockups.map((m) => (m.id === id ? { ...m, image: b64 } : m)),
            };
          }
          return next;
        });
      }
      try {
        localStorage.removeItem(ev.data.key);
        localStorage.removeItem(`${ev.data.key}:out`);
      } catch {
        /* ignore */
      }
      delete studioPending.current[ev.data.key];
    };
    ch.addEventListener("message", onMsg);
    return () => {
      ch.removeEventListener("message", onMsg);
      ch.close();
    };
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  async function api<T>(url: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const provider = activeProvider(settings);
    const aiKey = keyFor(settings, provider);
    headers["X-AI-Provider"] = provider;
    if (aiKey) headers["X-AI-Key"] = aiKey;
    if (settings.removeBgKey) headers["X-RemoveBg-Key"] = settings.removeBgKey;
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await r.text();
    let j: { error?: string } & Record<string, unknown> = {};
    try {
      j = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    if (!r.ok) {
      const providerLabel = provider === "gemini" ? "Google Gemini" : "OpenRouter";
      const rawMsg = j.error || text || `Request failed (${r.status})`;
      if (r.status === 504 || /timeout/i.test(rawMsg)) {
        throw new Error(`${providerLabel} took too long to respond. Please try again.`);
      }
      if (r.status === 402 || /credit|quota|exhaust|insufficient|billing|payment/i.test(rawMsg)) {
        const hint =
          provider === "gemini"
            ? "Check your Google AI Studio quota and billing at aistudio.google.com/apikey, or switch provider in Settings."
            : "Top up at openrouter.ai/credits, or switch provider in Settings.";
        throw new Error(`${providerLabel} credits exhausted — ${hint} (raw: ${rawMsg})`);
      }
      if (
        provider === "gemini" &&
        /limit: 0|free_tier|FreeTier|free tier/i.test(rawMsg) &&
        url !== "/api/generate-seo"
      ) {
        throw new Error(
          "Your Gemini key is on the free tier, which does not include image generation. Turn on billing for the key at aistudio.google.com (Fast mode costs about $0.04 per design), or use “Upload my design” to make the files without AI images. SEO text works on the free key.",
        );
      }
      if (r.status === 429) {
        throw new Error(
          `${providerLabel} rate-limited (too many requests). Wait a moment and retry. (raw: ${rawMsg})`,
        );
      }
      if (r.status === 401 && /missing api key/i.test(rawMsg)) {
        throw new Error(
          "No AI key is set. Open Settings (top menu) and add a Google Gemini or OpenRouter API key.",
        );
      }
      if (r.status === 401 || r.status === 403) {
        throw new Error(
          `${providerLabel} authentication failed — check your API key in Settings. (raw: ${rawMsg})`,
        );
      }
      throw new Error(`${providerLabel}: ${rawMsg}`);
    }
    return j as T;
  }

  async function apiWithRetry<T>(url: string, body: unknown, attempts = 2): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await api<T>(url, body);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  /** Transparent cut-out of the design: remove.bg when a key works, else the local fallback. */
  async function cutOut(design: string): Promise<string> {
    try {
      // remove.bg returns up to 25 MP; a high-quality JPEG keeps the 4K upload small.
      const input = await reencodeB64(design, { type: "image/jpeg", quality: 0.95 });
      const bgRes = await apiWithRetry<{ image: string }>("/api/remove-bg", { image: input }, 2);
      return bgRes.image;
    } catch (e) {
      console.warn("remove.bg unavailable; cutting out the white background locally", e);
      return removeWhiteBackground(design).catch(() => design);
    }
  }

  /** Only cut-out types get a transparent PNG; full-bleed and printable pages keep their canvas. */
  const prepareArt = (design: string, typeId: ProductTypeId) =>
    getProductType(typeId).background === "transparent" ? cutOut(design) : Promise.resolve(design);

  /** Mockups only need a preview-sized copy of the 4K design as their input image. */
  const mockupInput = (transparent: string) =>
    reencodeB64(transparent, { maxSide: 1536 }).catch(() => transparent);

  /** Warn (without failing) when the provider could not return a native 4K design. */
  async function checkNative4k(design: string) {
    const { width, height } = await imageSize(design).catch(() => ({ width: 0, height: 0 }));
    if (settings.imageQuality === "fast") return;
    if (width && Math.max(width, height) < 4096) {
      toast.warning(
        `Artwork came back at ${width}×${height}px, not native 4K. Files are upscaled to 4096px. The 4K model may have been busy, so try again for native 4K.`,
        { duration: 10000 },
      );
    }
  }

  async function generateOneProduct(
    keyword: string,
    variationIndex: number,
    totalVariations: number,
    onStage?: (stage: string) => void,
  ): Promise<ProductItem> {
    const typeId = productType.id;
    onStage?.("Writing SEO listing…");
    const seoRes = await api<SEO>("/api/generate-seo", {
      idea: keyword,
      shop,
      productType: typeId,
    });
    if (seoRes.mature)
      toast.warning(
        "This design has swear words. On Etsy, mark the listing as mature content and keep the word out of the title and first photo.",
      );

    const uniquenessClause: Record<typeof uniqueness, string> = {
      subtle:
        "Use a SUBTLY different composition and small color palette tweak — same overall style and mood as the other variations, just minor refinements.",
      balanced:
        "Use a clearly different composition, color palette, and stylistic interpretation than the other variations while keeping the same subject and commercial quality.",
      bold: "Use a BOLDLY different composition, dramatically different color palette, and a distinct artistic style (e.g. line-art vs watercolor vs flat vector) than the other variations. Same subject, very different look.",
      wild: "Treat this as a WILDLY different reinterpretation — completely different art style, mood, layout, perspective, and color world from the other variations. Push creativity hard. Same subject only.",
    };
    const variationPrompt =
      totalVariations > 1
        ? `${keyword}. Variation ${variationIndex + 1} of ${totalVariations}. ${uniquenessClause[uniqueness]} Maintain Etsy commercial print-ready quality.`
        : keyword;

    onStage?.("Generating artwork…");
    const imgRes = await apiWithRetry<{ image: string }>(
      "/api/generate-design",
      { prompt: variationPrompt, productType: typeId, fast: settings.imageQuality === "fast" },
      2,
    );
    void checkNative4k(imgRes.image);
    onStage?.(
      productType.background === "transparent" ? "Removing background…" : "Preparing files…",
    );
    const transparent = await prepareArt(imgRes.image, typeId);
    const mockupSrc = await mockupInput(transparent);
    const toGen = allMockups.filter((m) => selectedMockups.has(m.id));
    const mockupsList: Mockup[] = [];
    for (let mi = 0; mi < toGen.length; mi++) {
      const m = toGen[mi];
      onStage?.(`Mockup ${mi + 1}/${toGen.length}: ${m.label}…`);
      try {
        const body: Record<string, unknown> = {
          image: mockupSrc,
          mockup: m.id,
          formats: productType.formats,
        };
        if (m.id.startsWith("custom:")) body.customPrompt = m.label;
        const r = await apiWithRetry<{ image: string }>("/api/generate-mockup", body, 2);
        mockupsList.push({ id: m.id, label: m.label, image: r.image });
      } catch (e) {
        console.error("mockup failed", m.id, e);
      }
    }
    return {
      seo: seoRes,
      rawImage: imgRes.image,
      transparentImage: transparent,
      mockups: mockupsList,
      productType: typeId,
    };
  }

  /**
   * Use artwork the seller already has (e.g. made in the free Gemini app or Canva). Cut-out,
   * vector trace and print files run in the browser, so this works without an AI key; SEO and
   * mockups are added only when a key is set.
   */
  async function startFromUpload(file: File) {
    const name =
      parseKeywords(idea)[0] ||
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "My design";
    const withKey = hasAiKey(settings);
    const toGen = withKey ? allMockups.filter((m) => selectedMockups.has(m.id)) : [];
    if (withKey) {
      const ok = await confirmCost({
        provider: activeProvider(settings),
        products: 1,
        variations: 1,
        mockupsPerVariation: toGen.length,
        useRemoveBgApi: Boolean(settings.removeBgKey),
        uploaded: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    setErr(null);
    setSeo(null);
    setRawImage(null);
    setTransparentImage(null);
    setMockups([]);
    setBatch(null);
    setProgress(5);
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setResultType(productType.id);
    try {
      setStep("Reading your artwork…");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      // Normalise any JPG/WebP upload to PNG so every later step sees the same format.
      const design = await reencodeB64(dataUrl.replace(/^data:[^,]+,/, ""), {
        type: "image/png",
      });
      const { width, height } = await imageSize(design);
      if (Math.max(width, height) < 2048) {
        toast.warning(
          `Your image is ${width}×${height}px. Files are upscaled to 4096px; upload a larger image for the sharpest prints.`,
          { duration: 8000 },
        );
      }
      setRawImage(design);
      setProgress(25);

      setStep(
        productType.background === "transparent" ? "Removing background…" : "Preparing files…",
      );
      const transparent = await prepareArt(design, productType.id);
      setTransparentImage(transparent);
      setProgress(50);

      const placeholderSeo: SEO = { title: name, description: "", tags: [] };
      if (withKey) {
        setStep("Writing Etsy SEO listing…");
        try {
          setSeo(
            await api<SEO>("/api/generate-seo", {
              idea: name,
              shop,
              productType: productType.id,
            }),
          );
        } catch (e) {
          console.warn("SEO failed for uploaded design", e);
          setSeo(placeholderSeo);
        }
      } else {
        setSeo(placeholderSeo);
      }
      setProgress(60);

      const done: Mockup[] = [];
      const src = toGen.length ? await mockupInput(transparent) : "";
      for (let i = 0; i < toGen.length; i++) {
        const m = toGen[i];
        setStep(`Mockup ${i + 1}/${toGen.length}: ${m.label}…`);
        try {
          const body: Record<string, unknown> = {
            image: src,
            mockup: m.id,
            formats: productType.formats,
          };
          if (m.id.startsWith("custom:")) body.customPrompt = m.label;
          const r = await apiWithRetry<{ image: string }>("/api/generate-mockup", body, 2);
          done.push({ id: m.id, label: m.label, image: r.image });
        } catch (e) {
          console.error("mockup failed", m.id, e);
        }
        setMockups([...done]);
        setProgress(60 + Math.round(((i + 1) / toGen.length) * 40));
      }
      setProgress(100);
      setStep(
        withKey
          ? "Done!"
          : "Done! Files are ready. Add an AI key in Settings for SEO copy and mockups.",
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Returns the finished single product (used by the daily Etsy draft), or null. */
  async function generate(override?: {
    idea: string;
    type: ProductTypeId;
  }): Promise<ProductItem | null> {
    const productType = getProductType(override ? override.type : typePref.id);
    const ideaText = override?.idea ?? idea;
    if (!ideaText.trim()) return null;
    const keywords = parseKeywords(ideaText);
    if (keywords.length === 0) return null;
    const vCount = override ? 1 : Math.max(1, Math.min(5, variations));
    const isBatch = keywords.length > 1 || vCount > 1;

    const mockupsCount = allMockups.filter((m) => selectedMockups.has(m.id)).length;
    const ok = await confirmCost({
      provider: activeProvider(settings),
      products: keywords.length,
      variations: vCount,
      mockupsPerVariation: mockupsCount,
      useRemoveBgApi: Boolean(settings.removeBgKey),
      fastImage: settings.imageQuality === "fast",
    });
    if (!ok) return null;

    let single: ProductItem | null = null;
    setBusy(true);
    setErr(null);
    setSeo(null);
    setRawImage(null);
    setTransparentImage(null);
    setMockups([]);
    setProgress(0);
    setBatch(null);
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);

    try {
      if (!isBatch) {
        setStep("Writing Etsy SEO listing…");
        setProgress(5);
        setResultType(productType.id);
        const seoRes = await api<SEO>("/api/generate-seo", {
          idea: keywords[0],
          shop,
          productType: productType.id,
        });
        setSeo(seoRes);
        setProgress(15);

        setStep("Generating product artwork…");
        const imgRes = await apiWithRetry<{ image: string }>(
          "/api/generate-design",
          {
            prompt: keywords[0],
            productType: productType.id,
            fast: settings.imageQuality === "fast",
          },
          2,
        );
        setRawImage(imgRes.image);
        void checkNative4k(imgRes.image);
        setProgress(35);

        setStep(
          productType.background === "transparent" ? "Removing background…" : "Preparing files…",
        );
        const transparent = await prepareArt(imgRes.image, productType.id);
        setTransparentImage(transparent);
        setProgress(50);

        const wanted = override ? new Set(productType.mockups) : selectedMockups;
        const toGen = allMockups.filter((m) => wanted.has(m.id));
        if (toGen.length === 0) {
          setStep("Done! (no mockups selected)");
        } else {
          setStep(`Creating ${toGen.length} realistic mockup${toGen.length > 1 ? "s" : ""}…`);
          const done: Mockup[] = [];
          for (let i = 0; i < toGen.length; i++) {
            const m = toGen[i];
            try {
              const body: Record<string, unknown> = {
                image: await mockupInput(transparent),
                mockup: m.id,
                formats: productType.formats,
              };
              if (m.id.startsWith("custom:")) body.customPrompt = m.label;
              const r = await apiWithRetry<{ image: string }>("/api/generate-mockup", body, 2);
              done.push({ id: m.id, label: m.label, image: r.image });
            } catch (e) {
              console.error("mockup failed", m.id, e);
            }
            setMockups([...done]);
            setProgress(50 + Math.round(((i + 1) / toGen.length) * 50));
          }
          setStep("Done!");
          single = {
            seo: seoRes,
            rawImage: imgRes.image,
            transparentImage: transparent,
            mockups: done,
            productType: productType.id,
          };
        }
        single ??= {
          seo: seoRes,
          rawImage: imgRes.image,
          transparentImage: transparent,
          mockups: [],
          productType: productType.id,
        };
      } else {
        const total = keywords.length * vCount;
        let stepIdx = 0;
        const results: BatchProduct[] = keywords.map((k) => ({
          keyword: k,
          items: Array<ProductItem | null>(vCount).fill(null),
          expectedVariations: vCount,
        }));
        setBatch(results.map((p) => ({ ...p, items: [...p.items] })));
        for (let ki = 0; ki < keywords.length; ki++) {
          const kw = keywords[ki];
          for (let vi = 0; vi < vCount; vi++) {
            stepIdx++;
            setBatchCursor({ ki, vi });
            const prefix = `Product ${ki + 1}/${keywords.length} "${kw}" — variation ${vi + 1}/${vCount}`;
            setStep(`${prefix} • starting…`);
            const baseProg = ((stepIdx - 1) / total) * 100;
            const topProg = (stepIdx / total) * 100;
            try {
              const item = await generateOneProduct(kw, vi, vCount, (stage) => {
                setStep(`${prefix} • ${stage}`);
                setProgress(Math.min(99, Math.round(baseProg + (topProg - baseProg) * 0.5)));
              });
              results[ki].items[vi] = item;
            } catch (e) {
              console.error("product failed", kw, vi, e);
              setStep(`${prefix} • failed (skipped)`);
            }
            setBatch(results.map((p) => ({ ...p, items: [...p.items] })));
            setProgress(Math.round(topProg));
          }
        }
        const generated = results.reduce((a, p) => a + generatedCount(p.items), 0);
        setBatch(results.map((p) => ({ ...p, items: [...p.items] })));
        setBatchCursor(null);
        setStep(`Done! ${generated} of ${total} variation${total > 1 ? "s" : ""} generated.`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
    return single;
  }

  async function bundleProduct(folder: JSZip, item: ProductItem, opts: { useEdits: boolean }) {
    const { seo: pSeo, rawImage: pRaw, transparentImage: pTrans, mockups: pMockups } = item;
    const listing = `ETSY LISTING — ready to paste\n\nTITLE (${pSeo.title.length} chars)\n${pSeo.title}\n\nDESCRIPTION\n${pSeo.description}\n\nTAGS (${pSeo.tags.length}/13)\n${pSeo.tags.join(", ")}\n`;
    folder.file("listing.txt", listing);
    folder.file("listing.json", JSON.stringify(pSeo, null, 2));

    const transparentEdits = opts.useEdits
      ? getEdits("main:transparent", "design-transparent")
      : { ...DEFAULT_EDITS, filename: "design-transparent" };
    const rawEdits = opts.useEdits
      ? getEdits("main:raw", "design-original")
      : { ...DEFAULT_EDITS, filename: "design-original" };
    const transparentEdited =
      JSON.stringify({ ...transparentEdits, filename: "", include: true }) !==
      JSON.stringify({ ...DEFAULT_EDITS, filename: "", include: true });
    const rawEdited =
      JSON.stringify({ ...rawEdits, filename: "", include: true }) !==
      JSON.stringify({ ...DEFAULT_EDITS, filename: "", include: true });

    const dir = folder.folder("design")!;
    const type = getProductType(item.productType);
    if (type.background !== "transparent") {
      // Full-bleed and printable-page products: the artwork itself is the file the buyer prints.
      if (rawEdits.include) {
        for (const r of allResolutions) {
          if (rawEdited) {
            dir.file(
              `${safeFilename(rawEdits.filename || "design")}-${r.label}.jpg`,
              await bakeEdits(pRaw, rawEdits, r.size, "image/jpeg", 0.98),
            );
          } else {
            dir.file(`design-${r.label}.png`, await resizePng(pRaw, r.size, null));
            dir.file(`design-${r.label}.jpg`, await resizeJpegHQ(pRaw, r.size, 0.98));
          }
        }
        dir.file("design.pdf", await makePdf(pRaw, DEFAULT_EXPORT_SIZE));
        if (type.background === "white") {
          dir.file("print-us-letter.pdf", await makePagePdf(pRaw, "letter"));
          dir.file("print-a4.pdf", await makePagePdf(pRaw, "a4"));
        }
        if (type.id === "digital-paper") {
          // Scrapbook papers are sold as exact 12x12in sheets.
          dir.file("digital-paper-12x12in.jpg", await resizeJpegHQ(pRaw, 12 * PRINT_DPI, 0.98));
        }
        if (type.vector) {
          try {
            const lines = await removeWhiteBackground(pRaw);
            const vec = await traceVector(lines, DEFAULT_EXPORT_SIZE);
            dir.file("design.svg", vec.svg);
            dir.file("design.dxf", vec.dxf);
          } catch (e) {
            console.warn("vector trace failed", e);
          }
        }
      }
    } else if (transparentEdits.include) {
      for (const r of allResolutions) {
        if (transparentEdited) {
          dir.file(
            `${safeFilename(transparentEdits.filename || "design")}-${r.label}.jpg`,
            await bakeEdits(pTrans, transparentEdits, r.size, "image/jpeg", 0.98),
          );
        } else {
          dir.file(`design-${r.label}-transparent.png`, await resizePng(pTrans, r.size, null));
          dir.file(`design-${r.label}-white-bg.jpg`, await resizePng(pTrans, r.size, "#ffffff"));
        }
      }
      // Real vector cut files (SVG + DXF) for Cricut/Silhouette; fall back to an SVG that
      // wraps the PNG if tracing fails.
      try {
        const vec = await traceVector(pTrans, DEFAULT_EXPORT_SIZE);
        dir.file("design.svg", vec.svg);
        dir.file("design.dxf", vec.dxf);
      } catch (e) {
        console.warn("vector trace failed; exporting raster SVG", e);
        dir.file("design.svg", await makeSvg(pTrans, DEFAULT_EXPORT_SIZE));
      }
      const pdfBlob = await makePdf(pTrans, DEFAULT_EXPORT_SIZE);
      dir.file("design.pdf", pdfBlob);
      dir.file("design.ai", pdfBlob);
      dir.file("design.eps", await makeEps(pTrans, DEFAULT_EXPORT_SIZE));
    }
    if (type.background === "transparent" && rawEdits.include) {
      if (rawEdited) {
        dir.file(
          `${safeFilename(rawEdits.filename || "design-original")}.jpg`,
          await bakeEdits(pRaw, rawEdits, DEFAULT_EXPORT_SIZE, "image/jpeg", 0.98),
        );
      } else {
        dir.file("design-original.png", await resizePng(pRaw, DEFAULT_EXPORT_SIZE, null));
      }
    }

    const mdir = folder.folder("mockups")!;
    for (const m of pMockups) {
      const key = `mockup:${m.id}`;
      const defaultName = m.id
        .replace(/^custom:/, "custom-")
        .replace(/[^a-z0-9-_]/gi, "_")
        .slice(0, 60);
      const e = opts.useEdits
        ? getEdits(key, defaultName)
        : { ...DEFAULT_EDITS, filename: defaultName };
      if (!e.include) continue;
      const jpg = await bakeEdits(m.image, e, DEFAULT_EXPORT_SIZE, "image/jpeg", 0.98);
      mdir.file(`${safeFilename(e.filename || m.id)}.jpg`, jpg);
    }
  }

  const [draftBusy, setDraftBusy] = useState(false);
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [crochetDaily, setCrochetDaily] = useState<DailyItem | null>(null);
  const [dueDaily, setDueDaily] = useState<DailyItem | null>(null);

  /** Saves one product to Etsy as an inactive draft. Never publishes. */
  async function saveProductDraft(item: ProductItem, useEdits: boolean): Promise<DraftResult> {
    const zip = new JSZip();
    await bundleProduct(zip, item, { useEdits });
    // The buyer's download holds only the design files; listing text and mockups stay out.
    zip.remove("listing.txt");
    zip.remove("listing.json");
    zip.remove("mockups");
    const files: { name: string; blob: Blob }[] = [];
    const whole = await zip.generateAsync({ type: "blob" });
    const base = slugify(item.seo.title).slice(0, 50) || "design";
    if (whole.size <= ETSY_FILE_MAX) files.push({ name: `${base}.zip`, blob: whole });
    else {
      // Etsy takes 5 files of up to 20 MB each, so send the most useful formats on their own.
      const rank = (n: string) =>
        [".svg", ".pdf", ".png", ".dxf", ".jpg", ".eps"].findIndex((e) => n.endsWith(e));
      const entries = Object.values(zip.files)
        .filter((f) => !f.dir && rank(f.name) >= 0)
        .sort((a, b) => rank(a.name) - rank(b.name));
      for (const f of entries) {
        if (files.length >= 5) break;
        const blob = await f.async("blob");
        if (blob.size <= ETSY_FILE_MAX) files.push({ name: f.name.split("/").pop()!, blob });
      }
    }
    const photos = [...item.mockups.map((m) => m.image), item.rawImage];
    const images: string[] = [];
    for (const ph of photos.slice(0, 10))
      images.push(await blobToB64(await resizeJpegHQ(ph, 2000, 0.9)));
    return saveEtsyDraft({
      title: item.seo.title,
      description: item.seo.description,
      tags: item.seo.tags,
      price: settings.etsyPriceDigital,
      taxonomyWords: TAXONOMY_WORDS[item.productType] ?? ["digital"],
      images,
      files,
    });
  }

  async function saveDraftClick() {
    if (!seo || !rawImage || !transparentImage) return;
    setDraftBusy(true);
    try {
      const d = await saveProductDraft(
        { seo, rawImage, transparentImage, mockups, productType: resultType },
        true,
      );
      setDraftResult(d);
      toast.success(`Saved to Etsy as a draft (category: ${d.category}).`);
      if (d.problems.length) toast.warning(d.problems.join("\n"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDraftBusy(false);
    }
  }

  // Once a day: check the shop quietly, and make the next queued product as an Etsy draft.
  const dailyStarted = useRef(false);
  useEffect(() => {
    if (dailyStarted.current || !etsyConnected(settings)) return;
    dailyStarted.current = true;

    if (shopCheckDue())
      void etsyCall<{ listings: ListingLike[] }>({ action: "listings" })
        .then(({ listings }) => {
          const flagged = checkShop(listings, settings.etsyShopName).length;
          storeShopCheck({ at: todayKey(), total: listings.length, flagged });
          if (flagged)
            toast.warning(`Shop check: ${flagged} of ${listings.length} listings need attention.`, {
              action: { label: "Open", onClick: () => (window.location.href = "/etsy") },
            });
        })
        .catch((e: Error) => console.warn("shop check failed", e.message));

    const picked = search.daily
      ? (loadQueue().find((i) => i.id === search.daily && !i.doneAt) ?? null)
      : dueDailyItem();
    if (!picked) return;
    if (!search.daily && !settings.dailyAuto) {
      setDueDaily(picked);
      return;
    }
    void runDaily(picked, !search.daily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.etsyShopId, search.daily]);

  async function runDaily(item: DailyItem, auto: boolean) {
    setDueDaily(null);
    if (item.kind === "crochet") {
      setActiveTab("crochet");
      setCrochetDaily(item);
      return;
    }
    const type = getProductType(item.kind).id;
    setActiveTab("product");
    setTypePref({ id: type });
    setIdea(item.idea);
    toast.info(`Making today's Etsy draft: ${item.idea}`);
    skipCostRef.current = auto;
    const result = await generate({ idea: item.idea, type });
    skipCostRef.current = false;
    if (!result) {
      markDaily(item.id, { error: "generation failed or was cancelled" });
      return;
    }
    try {
      const d = await saveProductDraft(result, false);
      setDraftResult(d);
      markDaily(item.id, { doneAt: todayKey(), listingId: d.listingId, editUrl: d.editUrl });
      toast.success("Today's draft is saved on Etsy.");
    } catch (e) {
      markDaily(item.id, { error: (e as Error).message.slice(0, 160) });
      toast.error((e as Error).message);
    }
  }

  async function downloadZip() {
    const hasSingle = seo && rawImage && transparentImage;
    const hasBatch = isBatchComplete(batch);
    if (!hasSingle && !hasBatch) return;
    setStep("Bundling ZIP…");
    setBusy(true);
    try {
      const zip = new JSZip();
      if (hasBatch) {
        for (const product of batch!) {
          if (generatedCount(product.items) === 0) continue;
          const productFolder = zip.folder(slugify(product.keyword))!;
          for (let i = 0; i < product.expectedVariations; i++) {
            const item = product.items[i];
            if (!item) continue;
            const sub =
              product.expectedVariations > 1
                ? productFolder.folder(`variation-${i + 1}`)!
                : productFolder;
            await bundleProduct(sub, item, { useEdits: false });
          }
        }
      } else if (hasSingle) {
        await bundleProduct(
          zip,
          {
            seo: seo!,
            rawImage: rawImage!,
            transparentImage: transparentImage!,
            mockups,
            productType: resultType,
          },
          { useEdits: true },
        );
      }

      if (video) zip.file(`product-video.${video.ext}`, video.blob);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etsy-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStep("ZIP downloaded.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateVideo() {
    if (!transparentImage) return;
    setVideoBusy(true);
    setErr(null);
    if (video) {
      URL.revokeObjectURL(video.url);
      setVideo(null);
    }
    try {
      const blob = await makeShowcaseVideo(transparentImage);
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      setVideo({ blob, url: URL.createObjectURL(blob), ext });
    } catch (e) {
      setErr("Video generation failed: " + (e as Error).message);
    } finally {
      setVideoBusy(false);
    }
  }

  // Compute editor element outside JSX to avoid IIFE inside the route's split component.
  let editorEl: React.ReactNode = null;
  if (editorOpen) {
    let src: string | null = null;
    let title = "";
    let defaultName = "";
    let canRegen = false;
    let onRegen: ((tweak: string) => Promise<void>) | undefined;
    if (editorOpen === "main:raw" && rawImage) {
      src = rawImage;
      title = "Original artwork";
      defaultName = "design-original";
    } else if (editorOpen === "main:transparent" && transparentImage) {
      src = transparentImage;
      title = "Transparent artwork";
      defaultName = "design-transparent";
    } else if (editorOpen.startsWith("mockup:")) {
      const id = editorOpen.slice(7);
      const m = mockups.find((x) => x.id === id);
      if (m) {
        src = m.image;
        title = m.label;
        defaultName = m.id
          .replace(/^custom:/, "custom-")
          .replace(/[^a-z0-9-_]/gi, "_")
          .slice(0, 60);
        canRegen = true;
        onRegen = (tweak: string) => regenerateMockup(m, tweak);
      }
    }
    if (src) {
      const current = getEdits(editorOpen, defaultName);
      editorEl = (
        <ImageEditor
          open={true}
          onOpenChange={(v) => {
            if (!v) setEditorOpen(null);
          }}
          title={title}
          srcB64={src}
          edits={current}
          onSave={(e) => setKeyEdits(editorOpen!, e)}
          canRegenerate={canRegen}
          onRegenerate={onRegen}
          regenerating={regenBusy}
        />
      );
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <SiteHeader
          active={activeTab}
          onNavigate={setActiveTab}
          actions={
            <>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </>
          }
        />

        {activeTab === "home" ? (
          <LandingPage
            onStart={(t) => {
              if (t) setTypePref({ id: t });
              setActiveTab("product");
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col">
            <aside className={`w-full ${activeTab !== "product" ? "hidden" : ""}`}>
              <div className="border-b border-border bg-paper">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-end sm:justify-between lg:px-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Product generator
                    </p>
                    <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                      Describe your product
                    </h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                      Pick an Etsy product type, then get SEO copy, native 4K print-ready files and
                      realistic mockups in one run.
                    </p>
                  </div>
                  <a
                    href="/editor?demo=1"
                    target="_blank"
                    rel="noopener"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="h-4 w-4 text-primary" /> Try Image Studio demo
                  </a>
                </div>
              </div>
              <div className="mx-auto w-full max-w-5xl p-6 lg:p-8">
                <Card className="paper-card">
                  <CardHeader className="sr-only">
                    <CardTitle>Describe your product</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6 sm:p-8">
                    <fieldset>
                      <legend className="text-sm font-medium">Product type</legend>
                      <div
                        role="radiogroup"
                        className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                      >
                        {PRODUCT_TYPES.map((t) => {
                          const on = t.id === productType.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={busy}
                              onClick={() => setTypePref({ id: t.id })}
                              className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                                on
                                  ? "border-primary bg-accent ring-1 ring-primary"
                                  : "border-border bg-card hover:border-foreground/30"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{t.label}</span>
                                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {t.aspectRatio}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {t.blurb}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Buyer gets: {productType.receives}.
                      </p>
                    </fieldset>

                    <div>
                      <Label htmlFor="idea">Product idea(s)</Label>
                      <Textarea
                        id="idea"
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder={`One product per line (max 10). e.g.\n${productType.placeholder}`}
                        rows={5}
                        disabled={busy}
                        className="mt-1.5"
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Enter one keyword per line (or separate by commas) — up to 10 products in
                        one batch. Avoid trademarked names. All output is original for Etsy
                        commercial use.
                      </p>
                      {(() => {
                        const kws = parseKeywords(idea);
                        if (kws.length === 0) return null;
                        return (
                          <p className="mt-1 text-xs font-medium text-primary">
                            {kws.length} product{kws.length > 1 ? "s" : ""} ×{" "}
                            {Math.max(1, Math.min(5, variations))} variation
                            {variations > 1 ? "s" : ""} ={" "}
                            {kws.length * Math.max(1, Math.min(5, variations))} total generation
                            {kws.length * variations > 1 ? "s" : ""}
                          </p>
                        );
                      })()}
                    </div>

                    <div>
                      <Label htmlFor="vars">Variations per product</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <select
                          id="vars"
                          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                          value={variations}
                          disabled={busy}
                          onChange={(e) => setVariations(parseInt(e.target.value, 10))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Each variation uses a different composition & color palette for the same
                          keyword.
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="uniq">Uniqueness level</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <select
                          id="uniq"
                          className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
                          value={uniqueness}
                          disabled={busy}
                          onChange={(e) => setUniqueness(e.target.value as typeof uniqueness)}
                        >
                          <option value="subtle">Subtle</option>
                          <option value="balanced">Balanced (default)</option>
                          <option value="bold">Bold</option>
                          <option value="wild">Wild</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          How different each variation should look. Only applies when variations
                          &gt; 1.
                        </p>
                      </div>
                    </div>

                    <Collapsible open={shopOpen} onOpenChange={setShopOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <span>
                            Shop info & social links{" "}
                            {shop.shopName ? `— ${shop.shopName}` : "(optional)"}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${shopOpen ? "rotate-180" : ""}`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor="sn">Shop name (appears in copyright)</Label>
                          <Input
                            id="sn"
                            className="mt-1.5"
                            placeholder="KatherineDream"
                            value={shop.shopName}
                            onChange={(e) => setShop({ ...shop, shopName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ig">Instagram</Label>
                          <Input
                            id="ig"
                            className="mt-1.5"
                            placeholder="@yourhandle"
                            value={shop.instagram}
                            onChange={(e) => setShop({ ...shop, instagram: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="pi">Pinterest</Label>
                          <Input
                            id="pi"
                            className="mt-1.5"
                            placeholder="@yourhandle or pinterest.com/..."
                            value={shop.pinterest}
                            onChange={(e) => setShop({ ...shop, pinterest: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="fb">Facebook</Label>
                          <Input
                            id="fb"
                            className="mt-1.5"
                            placeholder="facebook.com/..."
                            value={shop.facebook}
                            onChange={(e) => setShop({ ...shop, facebook: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="em">Email</Label>
                          <Input
                            id="em"
                            className="mt-1.5"
                            placeholder="you@example.com"
                            value={shop.email}
                            onChange={(e) => setShop({ ...shop, email: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="et">Etsy store URL</Label>
                          <Input
                            id="et"
                            className="mt-1.5"
                            placeholder="https://www.etsy.com/shop/..."
                            value={shop.etsy}
                            onChange={(e) => setShop({ ...shop, etsy: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ws">Website</Label>
                          <Input
                            id="ws"
                            className="mt-1.5"
                            placeholder="https://yoursite.com"
                            value={shop.website}
                            onChange={(e) => setShop({ ...shop, website: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          These get appended to every generated description along with a copyright
                          disclaimer.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={mockupPickerOpen} onOpenChange={setMockupPickerOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <span>
                            Mockups & export options — {totalSelected} selected,{" "}
                            {allResolutions.length} resolution{allResolutions.length > 1 ? "s" : ""}
                          </span>
                          {mockupPickerOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-4 rounded-md border border-border p-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <Label>Pick which mockups to generate</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setSelectedMockups(new Set(allMockups.map((m) => m.id)))
                                }
                              >
                                All
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setSelectedMockups(new Set())}
                              >
                                None
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {allMockups.map((m) => (
                              <label
                                key={m.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2 text-sm hover:bg-accent"
                              >
                                <Checkbox
                                  checked={selectedMockups.has(m.id)}
                                  onCheckedChange={(v) => {
                                    const s = new Set(selectedMockups);
                                    if (v) s.add(m.id);
                                    else s.delete(m.id);
                                    setSelectedMockups(s);
                                  }}
                                />
                                <span className="truncate">{m.label}</span>
                                {m.id.startsWith("custom:") && (
                                  <button
                                    type="button"
                                    aria-label="Remove custom mockup"
                                    className="ml-auto opacity-50 hover:opacity-100"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCustomMockups(customMockups.filter((c) => c !== m.label));
                                      const s = new Set(selectedMockups);
                                      s.delete(m.id);
                                      setSelectedMockups(s);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="cm">Other — add your own mockup type</Label>
                          <div className="mt-1.5 flex gap-2">
                            <Input
                              id="cm"
                              placeholder="e.g. yoga mat, beach towel, laptop sleeve"
                              value={customMockupInput}
                              onChange={(e) => setCustomMockupInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const v = customMockupInput.trim();
                                  if (v && !customMockups.includes(v) && v.length <= 60) {
                                    setCustomMockups([...customMockups, v]);
                                    setSelectedMockups(
                                      new Set([...selectedMockups, `custom:${v}`]),
                                    );
                                    setCustomMockupInput("");
                                  }
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const v = customMockupInput.trim();
                                if (v && !customMockups.includes(v) && v.length <= 60) {
                                  setCustomMockups([...customMockups, v]);
                                  setSelectedMockups(new Set([...selectedMockups, `custom:${v}`]));
                                  setCustomMockupInput("");
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" /> Add
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Press Enter or click Add. Each custom type is generated separately.
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="cs">
                            Custom main-image resolution (extra sizes for the design folder)
                          </Label>
                          <div className="mt-1.5 flex gap-2">
                            <Input
                              id="cs"
                              type="number"
                              min={DEFAULT_EXPORT_SIZE}
                              max={8192}
                              placeholder="e.g. 3000"
                              value={customSizeInput}
                              onChange={(e) => setCustomSizeInput(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const n = parseInt(customSizeInput, 10);
                                if (
                                  Number.isFinite(n) &&
                                  n >= DEFAULT_EXPORT_SIZE &&
                                  n <= 8192 &&
                                  !customSizes.includes(n) &&
                                  !RES.some((r) => r.size === n)
                                ) {
                                  setCustomSizes([...customSizes, n].sort((a, b) => a - b));
                                  setCustomSizeInput("");
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" /> Add size
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[...RES.map((r) => r.size), ...customSizes]
                              .sort((a, b) => a - b)
                              .map((s) => (
                                <Badge
                                  key={s}
                                  variant={customSizes.includes(s) ? "default" : "secondary"}
                                  className="gap-1"
                                >
                                  {s}×{s}
                                  {customSizes.includes(s) && (
                                    <button
                                      type="button"
                                      aria-label="Remove size"
                                      className="ml-0.5 opacity-70 hover:opacity-100"
                                      onClick={() =>
                                        setCustomSizes(customSizes.filter((x) => x !== s))
                                      }
                                    >
                                      ×
                                    </button>
                                  )}
                                </Badge>
                              ))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Default export is always 4K (4096×4096). Optional extra sizes can be
                            4096–8192 px and are added to the same <code>design/</code> folder as
                            transparent PNG and white-bg JPG.
                          </p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Button
                      onClick={() => void generate()}
                      disabled={busy || !idea.trim()}
                      size="lg"
                      className="h-12 rounded-full px-8 text-base glow-primary"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Working…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Generate
                        </>
                      )}
                    </Button>
                    <div className="rounded-xl border border-dashed border-border bg-paper/60 p-4">
                      <p className="text-sm font-medium">Already have the artwork?</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Upload a design you made yourself (for example in the free Gemini app or
                        Canva). The {productType.label.toLowerCase()} files (PNG, JPG, PDF
                        {productType.vector ? ", SVG, DXF" : ""}) are made in your browser with no
                        AI key. With a key you also get SEO copy and mockups.
                      </p>
                      <label
                        className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted ${busy ? "pointer-events-none opacity-50" : ""}`}
                      >
                        <Upload className="h-4 w-4" /> Upload my design
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void startFromUpload(f);
                          }}
                        />
                      </label>
                    </div>
                    {busy && (
                      <div className="space-y-2">
                        <Progress value={progress} />
                        <p className="text-xs text-muted-foreground">{step}</p>
                      </div>
                    )}
                    {err && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{err}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </aside>

            <section className="flex-1 min-w-0">
              {activeTab === "crochet" && (
                <div className="border-b border-border bg-paper">
                  <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Printable PDF patterns
                    </p>
                    <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                      Crochet Pattern Studio
                    </h1>
                  </div>
                </div>
              )}
              <div className="mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8">
                <div className={activeTab !== "crochet" ? "hidden" : "block"}>
                  <CrochetStudio
                    daily={crochetDaily}
                    apiCall={api}
                    shopName={shop.shopName}
                    shop={shop as unknown as Record<string, string>}
                  />
                </div>

                <div className={activeTab !== "product" ? "hidden" : "block space-y-6"}>
                  {dueDaily && !busy && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-accent p-4 text-sm">
                      <span>
                        Today&apos;s Etsy draft: <strong>{dueDaily.idea}</strong>
                      </span>
                      <Button size="sm" onClick={() => void runDaily(dueDaily, false)}>
                        Make today&apos;s draft
                      </Button>
                    </div>
                  )}
                  {draftResult && (
                    <div className="rounded-lg border border-sage/50 bg-card p-4 text-sm">
                      Saved to Etsy as a draft in “{draftResult.category}”.{" "}
                      <a
                        href={draftResult.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Review and publish it on Etsy
                      </a>
                      {draftResult.problems.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-destructive">
                          {draftResult.problems.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {seo && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Etsy SEO Listing — editable preview</CardTitle>
                        <CardDescription>
                          Edit anything below before downloading. Your changes (title, product name,
                          tagline, SEO keywords, tags, and disclaimer) go straight into the ZIP.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Field
                          label={`Title (${seo.title.length}/140)`}
                          onCopy={() => copy(seo.title, "t")}
                          copied={copied === "t"}
                        >
                          <Input
                            value={seo.title}
                            maxLength={140}
                            onChange={(e) => setSeo({ ...seo, title: e.target.value })}
                          />
                        </Field>
                        <Field
                          label={`Description (${seo.description.length} chars)`}
                          onCopy={() => copy(seo.description, "d")}
                          copied={copied === "d"}
                        >
                          <Textarea
                            value={seo.description}
                            onChange={(e) => setSeo({ ...seo, description: e.target.value })}
                            rows={20}
                            className="font-mono text-xs"
                          />
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Edit the product name, tagline, SEO keywords line, and copyright
                            disclaimer directly here.
                          </p>
                        </Field>
                        <Field
                          label={`Tags (${seo.tags.length}/13)`}
                          onCopy={() => copy(seo.tags.join(", "), "g")}
                          copied={copied === "g"}
                        >
                          <div className="space-y-2 rounded-md border border-input bg-background p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {seo.tags.map((t, i) => (
                                <Badge key={`${t}-${i}`} variant="secondary" className="gap-1">
                                  {t}
                                  <button
                                    type="button"
                                    aria-label={`Remove ${t}`}
                                    className="ml-0.5 opacity-60 hover:opacity-100"
                                    onClick={() =>
                                      setSeo({
                                        ...seo,
                                        tags: seo.tags.filter((_, idx) => idx !== i),
                                      })
                                    }
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ))}
                              {seo.tags.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  No tags. Add one below.
                                </span>
                              )}
                            </div>
                            {seo.tags.length < 13 && (
                              <Input
                                placeholder="Type a tag and press Enter (max 20 chars)"
                                maxLength={20}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const val = (e.currentTarget.value || "")
                                      .toLowerCase()
                                      .trim()
                                      .replace(/,/g, " ")
                                      .replace(/\s+/g, " ");
                                    if (val && !seo.tags.includes(val) && seo.tags.length < 13) {
                                      setSeo({ ...seo, tags: [...seo.tags, val] });
                                      e.currentTarget.value = "";
                                    }
                                  }
                                }}
                                className="h-8 text-sm"
                              />
                            )}
                          </div>
                        </Field>
                        <ShareRow seo={seo} shop={shop} />
                      </CardContent>
                    </Card>
                  )}

                  {(rawImage || transparentImage) && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Product Artwork</CardTitle>
                        <CardDescription>
                          Click <strong>Edit</strong> to customize colors, crop, banners,
                          background, and filename before download.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        {rawImage && (
                          <ArtworkTile
                            label={
                              getProductType(resultType).background === "transparent"
                                ? "Original (with background)"
                                : `${getProductType(resultType).label} (print file)`
                            }
                            src={`data:image/png;base64,${rawImage}`}
                            excluded={!getEdits("main:raw", "design-original").include}
                            onEdit={() => setEditorOpen("main:raw")}
                            onStudio={() => openInStudio("main:raw", rawImage)}
                          />
                        )}
                        {transparentImage &&
                          getProductType(resultType).background === "transparent" && (
                            <ArtworkTile
                              label="Transparent"
                              src={`data:image/png;base64,${transparentImage}`}
                              transparentBg
                              excluded={!getEdits("main:transparent", "design-transparent").include}
                              onEdit={() => setEditorOpen("main:transparent")}
                              onStudio={() => openInStudio("main:transparent", transparentImage)}
                            />
                          )}
                      </CardContent>
                    </Card>
                  )}

                  {mockups.length > 0 && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Mockups ({mockups.length})</CardTitle>
                        <CardDescription>
                          Click any image to customize — text banners, crop, color tuning,
                          background, regenerate, rename, or exclude from ZIP.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          {mockups.map((m) => {
                            const key = `mockup:${m.id}`;
                            const e = getEdits(
                              key,
                              m.id
                                .replace(/^custom:/, "custom-")
                                .replace(/[^a-z0-9-_]/gi, "_")
                                .slice(0, 60),
                            );
                            const customized =
                              JSON.stringify({ ...e, filename: "", include: true }) !==
                              JSON.stringify({ ...DEFAULT_EDITS, filename: "", include: true });
                            return (
                              <div key={m.id} className="group relative space-y-1.5">
                                <div className="relative">
                                  <img
                                    src={`data:image/png;base64,${m.image}`}
                                    className={`aspect-square w-full rounded-md border border-border object-cover ${!e.include ? "opacity-30" : ""}`}
                                    alt={m.label}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditorOpen(key)}
                                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100"
                                    aria-label={`Edit ${m.label}`}
                                  >
                                    <span className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium shadow">
                                      <Pencil className="h-3.5 w-3.5" /> Quick edit
                                    </span>
                                    <span
                                      role="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        openInStudio(
                                          `mockup:${m.id}` as `mockup:${string}`,
                                          m.image,
                                        );
                                      }}
                                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow"
                                    >
                                      <Palette className="h-3.5 w-3.5" /> Studio
                                    </span>
                                  </button>
                                  {!e.include && (
                                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-destructive/90 px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                                      <EyeOff className="h-3 w-3" /> Excluded
                                    </div>
                                  )}
                                  {customized && e.include && (
                                    <div className="absolute right-1.5 top-1.5 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                      Edited
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  {m.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Editor Dialog (single, switches by editorOpen key) */}
                  {editorEl}

                  {batch && batch.length > 0 && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>
                          Batch Results — {batch.reduce((a, p) => a + generatedCount(p.items), 0)}{" "}
                          variation
                          {batch.reduce((a, p) => a + generatedCount(p.items), 0) !== 1 ? "s" : ""}
                        </CardTitle>
                        <CardDescription>
                          Each keyword gets its own folder in the ZIP, with one sub-folder per
                          variation containing the full Etsy package (listing, artwork, mockups).
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {batch.map((product, pi) => {
                          const isActiveProduct = batchCursor?.ki === pi;
                          const doneCount = generatedCount(product.items);
                          const isDoneProduct =
                            batchCursor === null ? doneCount > 0 : batchCursor.ki > pi;
                          return (
                            <div
                              key={pi}
                              className={`space-y-3 rounded-md border p-4 ${isActiveProduct ? "border-primary/60 bg-primary/5" : "border-border"}`}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                  {isActiveProduct && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                  )}
                                  {isDoneProduct && !isActiveProduct && (
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  )}
                                  {pi + 1}. {product.keyword}
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                  {doneCount} / {product.expectedVariations} variation
                                  {product.expectedVariations > 1 ? "s" : ""}
                                  {isActiveProduct && batchCursor && ` • on v${batchCursor.vi + 1}`}
                                </span>
                              </div>
                              {doneCount === 0 && !isActiveProduct && busy && (
                                <p className="text-xs text-muted-foreground">Queued…</p>
                              )}
                              {isActiveProduct && (
                                <p className="text-xs text-primary font-medium">{step}</p>
                              )}
                              {product.items.map((item, vi) =>
                                item ? (
                                  <div
                                    key={vi}
                                    className="space-y-2 rounded border border-border/60 p-3"
                                  >
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Variation {vi + 1} —{" "}
                                      <span className="font-normal">
                                        {item.seo.title.slice(0, 80)}
                                        {item.seo.title.length > 80 ? "…" : ""}
                                      </span>
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                      <div className="relative group">
                                        <img
                                          src={`data:image/png;base64,${item.transparentImage}`}
                                          alt="design"
                                          className="aspect-square w-full rounded border border-border bg-[conic-gradient(at_top_left,_#e5e7eb_25%,_transparent_25%,_transparent_50%,_#e5e7eb_50%,_#e5e7eb_75%,_transparent_75%)] bg-[length:10px_10px] object-contain"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openInStudio(
                                              `batch:${pi}:${vi}:transparent`,
                                              item.transparentImage,
                                            )
                                          }
                                          className="absolute inset-x-1 bottom-1 rounded bg-background/90 px-1 py-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100"
                                        >
                                          Edit in Studio
                                        </button>
                                      </div>
                                      {item.mockups.slice(0, 5).map((m) => (
                                        <div key={m.id} className="relative group">
                                          <img
                                            src={`data:image/png;base64,${m.image}`}
                                            alt={m.label}
                                            className="aspect-square w-full rounded border border-border object-cover"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openInStudio(
                                                `batch:${pi}:${vi}:mockup:${m.id}`,
                                                m.image,
                                              )
                                            }
                                            className="absolute inset-x-1 bottom-1 rounded bg-background/90 px-1 py-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100"
                                          >
                                            Edit
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                          openInStudio(
                                            `batch:${pi}:${vi}:transparent`,
                                            item.transparentImage,
                                          )
                                        }
                                      >
                                        Edit design
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                          openInStudio(`batch:${pi}:${vi}:raw`, item.rawImage)
                                        }
                                      >
                                        Edit original
                                      </Button>
                                    </div>
                                    {item.mockups.length > 5 && (
                                      <p className="text-[10px] text-muted-foreground">
                                        + {item.mockups.length - 5} more mockup
                                        {item.mockups.length - 5 > 1 ? "s" : ""} in ZIP (hover any
                                        thumbnail to edit)
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    key={vi}
                                    className="rounded border border-dashed border-border/60 p-3 text-xs text-muted-foreground"
                                  >
                                    Variation {vi + 1} —{" "}
                                    {busy && isActiveProduct && batchCursor?.vi === vi
                                      ? "Generating…"
                                      : "Not generated"}
                                  </div>
                                ),
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {transparentImage && !batch && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Film className="h-5 w-5" /> Product Showcase Video
                        </CardTitle>
                        <CardDescription>
                          Generate a 5-second Etsy-style showcase clip (slow zoom on clean
                          background). Optional — adds ~10 seconds.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          onClick={generateVideo}
                          disabled={videoBusy || busy}
                          variant={video ? "outline" : "default"}
                        >
                          {videoBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Rendering…
                            </>
                          ) : (
                            <>
                              <Film className="h-4 w-4" />{" "}
                              {video ? "Regenerate video" : "Generate 5-sec video"}
                            </>
                          )}
                        </Button>
                        {video && (
                          <video
                            src={video.url}
                            controls
                            autoPlay
                            loop
                            muted
                            className="w-full max-w-md rounded-md border border-border"
                          />
                        )}
                        {video && (
                          <p className="text-xs text-muted-foreground">
                            Included in ZIP as <code>product-video.{video.ext}</code>.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {((seo && transparentImage) || isBatchComplete(batch)) && !busy && (
                    <div className="sticky bottom-4 mt-6 flex justify-end gap-2">
                      {seo && transparentImage && !batch && etsyConnected(settings) && (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={saveDraftClick}
                          disabled={draftBusy}
                          className="bg-background shadow-lg"
                        >
                          {draftBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Store className="h-4 w-4" />
                          )}
                          Save as Etsy draft
                        </Button>
                      )}
                      <Button size="lg" onClick={downloadZip} className="shadow-lg">
                        <Download className="h-4 w-4" /> Download ZIP
                        {batch
                          ? ` (${batch.reduce((a, p) => a + generatedCount(p.items), 0)} variation${batch.reduce((a, p) => a + generatedCount(p.items), 0) !== 1 ? "s" : ""})`
                          : ""}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
        <SiteFooter />
      </div>

      <CostEstimateDialog
        open={costOpen}
        estimate={costEstimate}
        onCancel={handleCostCancel}
        onConfirm={handleCostConfirm}
      />
    </>
  );
}

function Field({
  label,
  onCopy,
  copied,
  children,
}: {
  label: string;
  onCopy: () => void;
  copied: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>{label}</Label>
        <Button variant="ghost" size="sm" onClick={onCopy} className="h-7">
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </Button>
      </div>
      {children}
    </div>
  );
}

function ShareRow({ seo, shop }: { seo: SEO; shop: Shop }) {
  const pi = normalizeSocial(shop.pinterest, "pinterest");
  const fb = normalizeSocial(shop.facebook, "facebook");
  const et = normalizeSocial(shop.etsy, "etsy");
  const ws = normalizeSocial(shop.website, "website");
  const shareUrl = (et?.url || ws?.url || "https://www.etsy.com").trim();
  const quote = `${seo.title}`.slice(0, 280);
  const pinUrl = pinterestShareUrl({ url: shareUrl, description: quote });
  const fbUrl = facebookShareUrl({ url: shareUrl, quote });
  return (
    <div className="rounded-md border border-input bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Share2 className="h-4 w-4" /> Share this listing
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={pinUrl} target="_blank" rel="noopener noreferrer">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E60023] text-[10px] font-bold text-white">
              P
            </span>
            Pinterest
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={fbUrl} target="_blank" rel="noopener noreferrer">
            <Facebook className="h-4 w-4 text-[#1877F2]" />
            Facebook
          </a>
        </Button>
        {pi && (
          <Badge variant="secondary" className="font-normal">
            Pinterest:{" "}
            <a href={pi.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
              {pi.display}
            </a>
          </Badge>
        )}
        {fb && (
          <Badge variant="secondary" className="font-normal">
            Facebook:{" "}
            <a href={fb.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
              {fb.display}
            </a>
          </Badge>
        )}
      </div>
      {!shop.etsy && !shop.website && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: add your Etsy shop or website URL in Shop info so share links point to your listing.
        </p>
      )}
    </div>
  );
}

function ArtworkTile({
  label,
  src,
  transparentBg,
  excluded,
  onEdit,
  onStudio,
}: {
  label: string;
  src: string;
  transparentBg?: boolean;
  excluded?: boolean;
  onEdit: () => void;
  onStudio?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {label}
          {excluded && <span className="ml-2 text-xs text-destructive">(excluded)</span>}
        </p>
        <div className="flex gap-1">
          {onStudio && (
            <Button
              size="sm"
              variant="outline"
              onClick={onStudio}
              className="h-7"
              title="Open in full editor (layers, text, fonts, shapes)"
            >
              <Palette className="h-3 w-3" /> Studio
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit} className="h-7">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>
      </div>
      <div
        className={transparentBg ? "rounded-md border border-border" : ""}
        style={
          transparentBg
            ? {
                // Checkerboard so the transparent cut-out is visible.
                background:
                  "repeating-conic-gradient(color-mix(in srgb, var(--foreground) 9%, transparent) 0% 25%, transparent 0% 50%) 50% / 20px 20px",
              }
            : undefined
        }
      >
        <img
          src={src}
          className={`w-full rounded-md ${transparentBg ? "" : "border border-border"} ${excluded ? "opacity-30" : ""}`}
          alt={label}
        />
      </div>
    </div>
  );
}
