import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  Moon,
  Sun,
  Sparkles,
  Download,
  Loader2,
  Wand2,
  Copy,
  Check,
  AlertCircle,
  Settings as SettingsIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { PRINT_DPI, removeWhiteBackground, traceVector, withDpi } from "@/lib/print-export";

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
];

const DEFAULT_SELECTED = new Set([
  "digital-download",
  "banner-top-bottom",
  "white-tshirt",
  "mug",
  "wall-frame",
  "tote-bag",
]);

const DEFAULT_EXPORT_SIZE = 4096;
const RES = [{ label: "4096", size: DEFAULT_EXPORT_SIZE }];

type SEO = { title: string; description: string; tags: string[] };
type Mockup = { id: string; label: string; image: string };
type ProductItem = { seo: SEO; rawImage: string; transparentImage: string; mockups: Mockup[] };
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

type AIProvider = "lovable" | "openai" | "gemini" | "openrouter";
export type KwProvider =
  | "semrush"
  | "semrush_user"
  | "ahrefs"
  | "keywords_everywhere"
  | "erank"
  | "alura";
type Settings = {
  aiProvider: AIProvider;
  lovableKey: string;
  openaiKey: string;
  geminiKey: string;
  openrouterKey: string;
  removeBgKey: string;
  kwProvider: KwProvider;
  semrushUserKey: string;
  ahrefsKey: string;
  kwEverywhereKey: string;
};
type Shop = {
  shopName: string;
  instagram: string;
  pinterest: string;
  facebook: string;
  etsy: string;
  website: string;
  email: string;
};

const DEFAULT_SETTINGS: Settings = {
  aiProvider: "lovable",
  lovableKey: "",
  openaiKey: "",
  geminiKey: "",
  openrouterKey: "",
  removeBgKey: "",
  kwProvider: "semrush",
  semrushUserKey: "",
  ahrefsKey: "",
  kwEverywhereKey: "",
};
/**
 * The Default AI gateway only has a key when the app runs on Lovable hosting. When the user
 * kept it selected but entered a key for another provider, use that provider instead.
 */
function activeProvider(s: Settings): AIProvider {
  if (s.aiProvider !== "lovable" || s.lovableKey) return s.aiProvider;
  if (s.geminiKey) return "gemini";
  if (s.openaiKey) return "openai";
  if (s.openrouterKey) return "openrouter";
  return "lovable";
}

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

async function resizePng(b64: string, size: number, withBg: string | null): Promise<Blob> {
  const img = await loadImage(b64);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (withBg) {
    ctx.fillStyle = withBg;
    ctx.fillRect(0, 0, size, size);
  }
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, size, size);
  if (size > img.width) applyUnsharp(ctx, size, size);
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
  const w = size / PRINT_DPI,
    h = size / PRINT_DPI;
  const pdf = new jsPDF({ unit: "in", format: [w, h], orientation: w > h ? "l" : "p" });
  pdf.addImage(imageUrl, "PNG", 0, 0, w, h, undefined, "FAST");
  return pdf.output("blob");
}

function makeSvg(b64: string, size = DEFAULT_EXPORT_SIZE): Blob {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <image href="data:image/png;base64,${b64}" width="${size}" height="${size}"/>
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
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, size, size);
  if (size > img.width) applyUnsharp(ctx, size, size);
  return canvasToBlob(c, "image/jpeg", quality);
}

async function resizeJpegUnder(
  b64: string,
  size: number,
  maxBytes: number,
  bg = "#ffffff",
): Promise<Blob> {
  const img = await loadImage(b64);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  drawImageHQ(ctx, img, 0, 0, img.width, img.height, 0, 0, size, size);
  if (size > img.width) applyUnsharp(ctx, size, size);
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

async function makeEps(b64: string, size: number): Promise<Blob> {
  const jpegBlob = await resizeJpegUnder(b64, size, 5_000_000, "#ffffff");
  const buf = new Uint8Array(await jpegBlob.arrayBuffer());
  let hex = "";
  for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16).padStart(2, "0");
  const wrapped = hex.match(/.{1,64}/g)!.join("\n");
  const eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${size} ${size}
%%EndComments
gsave
0 0 translate
${size} ${size} scale
/DeviceRGB setcolorspace
<<
  /ImageType 1
  /Width ${size}
  /Height ${size}
  /ImageMatrix [${size} 0 0 -${size} 0 ${size}]
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
  const [activeTab, setActiveTab] = useState<"product" | "crochet" | "home">("home");
  const { theme, toggle } = useTheme();
  const [settings, setSettings] = useLocal<Settings>("etsyforge:settings", DEFAULT_SETTINGS);
  const [shop, setShop] = useLocal<Shop>("etsyforge:shop", DEFAULT_SHOP);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    setDraftSettings(settings);
  }, [settings, settingsOpen]);

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
      const body: Record<string, unknown> = { image: transparentImage, mockup: m.id, tweak };
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
    const aiKey =
      provider === "openai"
        ? settings.openaiKey
        : provider === "gemini"
          ? settings.geminiKey
          : provider === "openrouter"
            ? settings.openrouterKey
            : settings.lovableKey;
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
      const providerLabel =
        provider === "lovable"
          ? "Default AI"
          : provider === "openai"
            ? "OpenAI"
            : provider === "gemini"
              ? "Google Gemini"
              : provider === "openrouter"
                ? "OpenRouter"
                : provider;
      const rawMsg = j.error || text || `Request failed (${r.status})`;
      if (r.status === 504 || /timeout/i.test(rawMsg)) {
        throw new Error(`${providerLabel} took too long to respond. Please try again.`);
      }
      if (r.status === 402 || /credit|quota|exhaust|insufficient|billing|payment/i.test(rawMsg)) {
        const hint =
          provider === "lovable"
            ? "Workspace credits exhausted. Switch provider in Settings (Gemini has 1,500 free/day)."
            : provider === "openai"
              ? "Top up at platform.openai.com/account/billing, or switch provider in Settings."
              : provider === "gemini"
                ? "Check your Google AI Studio quota at aistudio.google.com/apikey, or switch provider in Settings."
                : provider === "openrouter"
                  ? "Top up at openrouter.ai/credits, or switch provider in Settings."
                  : "Switch provider in Settings.";
        throw new Error(`${providerLabel} credits exhausted — ${hint} (raw: ${rawMsg})`);
      }
      if (r.status === 429) {
        throw new Error(
          `${providerLabel} rate-limited (too many requests). Wait a moment and retry. (raw: ${rawMsg})`,
        );
      }
      if (r.status === 401 && /missing api key/i.test(rawMsg)) {
        throw new Error(
          "No AI key is set. Open Settings (gear icon, top right) and add a Google Gemini, OpenAI or OpenRouter API key.",
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

  async function generateOneProduct(
    keyword: string,
    variationIndex: number,
    totalVariations: number,
    onStage?: (stage: string) => void,
  ): Promise<ProductItem> {
    onStage?.("Writing SEO listing…");
    const seoRes = await api<SEO>("/api/generate-seo", { idea: keyword, shop });

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
      { prompt: variationPrompt },
      2,
    );
    onStage?.("Removing background…");
    let transparent = imgRes.image;
    try {
      const bgRes = await apiWithRetry<{ image: string }>(
        "/api/remove-bg",
        { image: imgRes.image },
        2,
      );
      transparent = bgRes.image;
    } catch (e) {
      console.warn("remove.bg unavailable; cutting out the white background locally", e);
      transparent = await removeWhiteBackground(imgRes.image).catch(() => imgRes.image);
    }
    const toGen = allMockups.filter((m) => selectedMockups.has(m.id));
    const mockupsList: Mockup[] = [];
    for (let mi = 0; mi < toGen.length; mi++) {
      const m = toGen[mi];
      onStage?.(`Mockup ${mi + 1}/${toGen.length}: ${m.label}…`);
      try {
        const body: Record<string, unknown> = { image: transparent, mockup: m.id };
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
    };
  }

  async function generate() {
    if (!idea.trim()) return;
    const keywords = parseKeywords(idea);
    if (keywords.length === 0) return;
    const vCount = Math.max(1, Math.min(5, variations));
    const isBatch = keywords.length > 1 || vCount > 1;

    const mockupsCount = allMockups.filter((m) => selectedMockups.has(m.id)).length;
    const ok = await confirmCost({
      provider: activeProvider(settings),
      products: keywords.length,
      variations: vCount,
      mockupsPerVariation: mockupsCount,
      useRemoveBgApi: Boolean(settings.removeBgKey),
    });
    if (!ok) return;

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
        const seoRes = await api<SEO>("/api/generate-seo", { idea: keywords[0], shop });
        setSeo(seoRes);
        setProgress(15);

        setStep("Generating product artwork…");
        const imgRes = await apiWithRetry<{ image: string }>(
          "/api/generate-design",
          { prompt: keywords[0] },
          2,
        );
        setRawImage(imgRes.image);
        setProgress(35);

        setStep("Removing background…");
        let transparent = imgRes.image;
        try {
          const bgRes = await apiWithRetry<{ image: string }>(
            "/api/remove-bg",
            { image: imgRes.image },
            2,
          );
          transparent = bgRes.image;
        } catch (e) {
          console.warn("remove.bg unavailable; cutting out the white background locally", e);
          transparent = await removeWhiteBackground(imgRes.image).catch(() => imgRes.image);
        }
        setTransparentImage(transparent);
        setProgress(50);

        const toGen = allMockups.filter((m) => selectedMockups.has(m.id));
        if (toGen.length === 0) {
          setStep("Done! (no mockups selected)");
        } else {
          setStep(`Creating ${toGen.length} realistic mockup${toGen.length > 1 ? "s" : ""}…`);
          const done: Mockup[] = [];
          for (let i = 0; i < toGen.length; i++) {
            const m = toGen[i];
            try {
              const body: Record<string, unknown> = { image: transparent, mockup: m.id };
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
        }
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
    if (transparentEdits.include) {
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
        dir.file("design.svg", makeSvg(pTrans, DEFAULT_EXPORT_SIZE));
      }
      const pdfBlob = await makePdf(pTrans, DEFAULT_EXPORT_SIZE);
      dir.file("design.pdf", pdfBlob);
      dir.file("design.ai", pdfBlob);
      dir.file("design.eps", await makeEps(pTrans, DEFAULT_EXPORT_SIZE));
    }
    if (rawEdits.include) {
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
          { seo: seo!, rawImage: rawImage!, transparentImage: transparentImage!, mockups },
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
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background text-foreground shadow-sm">
          <div className="flex h-full items-center justify-between px-6 max-w-full mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold tracking-tight">
                  Digital Product Ai Automation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === "product" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("product")}
                className={`mr-2 hidden sm:inline-flex ${activeTab === "product" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                Describe your product
              </Button>
              <Button
                variant={activeTab === "crochet" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("crochet")}
                className={`mr-4 hidden sm:inline-flex ${activeTab === "crochet" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                Crochet Pattern Studio
              </Button>
              <Link to="/adobe-stock">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Adobe Stock</span>
                </Button>
              </Link>
              <Link to="/keywords">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Keyword Research</span>
                </Button>
              </Link>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Settings"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>AI Provider & API Keys</DialogTitle>
                    <DialogDescription>
                      Stored locally in your browser only. Pick a provider and paste your own key —
                      works on any host (local, RDP, Namecheap, Vercel).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label htmlFor="prov">AI Provider</Label>
                      <select
                        id="prov"
                        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draftSettings.aiProvider}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            aiProvider: e.target.value as AIProvider,
                          })
                        }
                      >
                        <option value="lovable">
                          Default AI (auto-provisioned on managed hosting)
                        </option>
                        <option value="gemini">
                          Google Gemini (recommended — generous free tier)
                        </option>
                        <option value="openai">OpenAI (highest quality, paid)</option>
                        <option value="openrouter">OpenRouter (one key for many models)</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {draftSettings.aiProvider === "gemini" && (
                          <>
                            Get a free key at{" "}
                            <a
                              href="https://aistudio.google.com/apikey"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              aistudio.google.com/apikey
                            </a>{" "}
                            — 1,500 free requests/day.
                          </>
                        )}
                        {draftSettings.aiProvider === "openai" && (
                          <>
                            Get a key at{" "}
                            <a
                              href="https://platform.openai.com/api-keys"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              platform.openai.com/api-keys
                            </a>
                            . Pay-per-use.
                          </>
                        )}
                        {draftSettings.aiProvider === "openrouter" && (
                          <>
                            Get a key at{" "}
                            <a
                              href="https://openrouter.ai/keys"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              openrouter.ai/keys
                            </a>
                            . Access OpenAI/Gemini/Claude with one key.
                          </>
                        )}
                        {draftSettings.aiProvider === "lovable" && (
                          <>
                            Only works on managed hosting (auto-provisioned). For self-hosting pick
                            Gemini, OpenAI, or OpenRouter.
                          </>
                        )}
                      </p>
                    </div>

                    {draftSettings.aiProvider === "lovable" && (
                      <div>
                        <Label htmlFor="lk">Muhammad Usman secret Key (optional override)</Label>
                        <Input
                          id="lk"
                          type="password"
                          autoComplete="off"
                          className="mt-1.5"
                          placeholder="Leave blank to use server default"
                          value={draftSettings.lovableKey}
                          onChange={(e) =>
                            setDraftSettings({ ...draftSettings, lovableKey: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {draftSettings.aiProvider === "gemini" && (
                      <div>
                        <Label htmlFor="gk">Google Gemini API Key</Label>
                        <Input
                          id="gk"
                          type="password"
                          autoComplete="off"
                          className="mt-1.5"
                          placeholder="AIza..."
                          value={draftSettings.geminiKey}
                          onChange={(e) =>
                            setDraftSettings({ ...draftSettings, geminiKey: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {draftSettings.aiProvider === "openai" && (
                      <div>
                        <Label htmlFor="ok">OpenAI API Key</Label>
                        <Input
                          id="ok"
                          type="password"
                          autoComplete="off"
                          className="mt-1.5"
                          placeholder="sk-..."
                          value={draftSettings.openaiKey}
                          onChange={(e) =>
                            setDraftSettings({ ...draftSettings, openaiKey: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {draftSettings.aiProvider === "openrouter" && (
                      <div>
                        <Label htmlFor="ork">OpenRouter API Key</Label>
                        <Input
                          id="ork"
                          type="password"
                          autoComplete="off"
                          className="mt-1.5"
                          placeholder="sk-or-..."
                          value={draftSettings.openrouterKey}
                          onChange={(e) =>
                            setDraftSettings({ ...draftSettings, openrouterKey: e.target.value })
                          }
                        />
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <Label htmlFor="rk">remove.bg API Key (for background removal)</Label>
                      <Input
                        id="rk"
                        type="password"
                        autoComplete="off"
                        className="mt-1.5"
                        placeholder="Your remove.bg key"
                        value={draftSettings.removeBgKey}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, removeBgKey: e.target.value })
                        }
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Free 50/month at{" "}
                        <a
                          href="https://www.remove.bg/api"
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          remove.bg/api
                        </a>
                        .
                      </p>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div>
                        <Label htmlFor="kwprov">Keyword Research Provider</Label>
                        <select
                          id="kwprov"
                          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                          value={draftSettings.kwProvider}
                          onChange={(e) =>
                            setDraftSettings({
                              ...draftSettings,
                              kwProvider: e.target.value as KwProvider,
                            })
                          }
                        >
                          <option value="semrush">
                            Semrush (built-in connector — no key needed)
                          </option>
                          <option value="semrush_user">Semrush (your own API key)</option>
                          <option value="ahrefs">Ahrefs (your own API key)</option>
                          <option value="keywords_everywhere">
                            Keywords Everywhere (your own API key)
                          </option>
                          <option value="erank">eRank (Etsy-focused, estimated)</option>
                          <option value="alura">Alura (Etsy-focused, estimated)</option>
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Used by the{" "}
                          <Link
                            to="/keywords"
                            className="underline"
                            onClick={() => setSettingsOpen(false)}
                          >
                            Keyword Research
                          </Link>{" "}
                          page. eRank & Alura don't expose public APIs — selecting them uses a
                          built-in Etsy keyword library with <em>estimated</em> volume/competition.
                          Semrush / Ahrefs / Keywords Everywhere return real data via API.
                        </p>
                      </div>

                      {draftSettings.kwProvider === "semrush_user" && (
                        <div>
                          <Label htmlFor="smk">Semrush API Key</Label>
                          <Input
                            id="smk"
                            type="password"
                            autoComplete="off"
                            className="mt-1.5"
                            placeholder="Your Semrush API key"
                            value={draftSettings.semrushUserKey}
                            onChange={(e) =>
                              setDraftSettings({ ...draftSettings, semrushUserKey: e.target.value })
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Get from{" "}
                            <a
                              href="https://www.semrush.com/accounts/subscription-info/api-units/"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Semrush API page
                            </a>{" "}
                            (requires Guru+ plan).
                          </p>
                        </div>
                      )}
                      {draftSettings.kwProvider === "ahrefs" && (
                        <div>
                          <Label htmlFor="ahk">Ahrefs API Token</Label>
                          <Input
                            id="ahk"
                            type="password"
                            autoComplete="off"
                            className="mt-1.5"
                            placeholder="Bearer token"
                            value={draftSettings.ahrefsKey}
                            onChange={(e) =>
                              setDraftSettings({ ...draftSettings, ahrefsKey: e.target.value })
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Get from{" "}
                            <a
                              href="https://app.ahrefs.com/api"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Ahrefs API
                            </a>{" "}
                            (API Access add-on required).
                          </p>
                        </div>
                      )}
                      {draftSettings.kwProvider === "keywords_everywhere" && (
                        <div>
                          <Label htmlFor="kek">Keywords Everywhere API Key</Label>
                          <Input
                            id="kek"
                            type="password"
                            autoComplete="off"
                            className="mt-1.5"
                            placeholder="Your KE API key"
                            value={draftSettings.kwEverywhereKey}
                            onChange={(e) =>
                              setDraftSettings({
                                ...draftSettings,
                                kwEverywhereKey: e.target.value,
                              })
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Pay-as-you-go credits. Get from{" "}
                            <a
                              href="https://keywordseverywhere.com/manage-api.html"
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              keywordseverywhere.com
                            </a>
                            .
                          </p>
                        </div>
                      )}
                      {draftSettings.kwProvider === "semrush" && (
                        <p className="text-xs text-muted-foreground">
                          Uses the built-in Semrush connector. No API key needed here. If not
                          connected yet, the Keyword Research page will show instructions.
                        </p>
                      )}
                      {(draftSettings.kwProvider === "erank" ||
                        draftSettings.kwProvider === "alura") && (
                        <p className="text-xs text-muted-foreground">
                          No API key required.{" "}
                          {draftSettings.kwProvider === "erank" ? "eRank" : "Alura"} doesn't offer a
                          public API, so we expand your seed against a curated Etsy keyword library.
                          Numbers are <strong>estimates</strong> — use Semrush/Ahrefs for real
                          metrics. For accurate eRank/Alura data, use their browser extension
                          directly.
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSettings(DEFAULT_SETTINGS);
                        setSettingsOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={() => {
                        setSettings(draftSettings);
                        setSettingsOpen(false);
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        {activeTab === "home" ? (
          <LandingPage onStart={() => setActiveTab("product")} />
        ) : (
          <div className="flex flex-1 flex-col">
            <aside
              className={`w-full border-b border-border bg-card/20 ${activeTab !== "product" ? "hidden" : ""}`}
            >
              <div className="mx-auto w-full max-w-5xl p-6 lg:p-8">
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5" /> Describe your product
                    </CardTitle>
                    <CardDescription>
                      Generate Etsy SEO copy, 4K print-ready art (PNG/JPG/SVG/PDF/EPS/AI/DXF), and
                      4K realistic mockups — all in one click. Commercial-use ready.
                    </CardDescription>
                    <div className="mt-2">
                      <a
                        href="/editor?demo=1"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Sparkles className="h-3 w-3" /> Try Image Studio with a demo product (no
                        API needed)
                      </a>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="idea">Product idea(s)</Label>
                      <Textarea
                        id="idea"
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder={
                          "One product per line (max 10). e.g.\nMinimalist mountain sunrise line art\nBoho sun and moon tattoo flash\nVintage botanical herb chart"
                        }
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

                    <Button onClick={generate} disabled={busy || !idea.trim()} size="lg">
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
              <div className="p-6 lg:p-8 space-y-6">
                <div className={activeTab !== "crochet" ? "hidden" : "block"}>
                  <CrochetStudio
                    apiCall={api}
                    shopName={shop.shopName}
                    shop={shop as unknown as Record<string, string>}
                  />
                </div>

                <div className={activeTab !== "product" ? "hidden" : "block space-y-6"}>
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
                            label="Original (with background)"
                            src={`data:image/png;base64,${rawImage}`}
                            excluded={!getEdits("main:raw", "design-original").include}
                            onEdit={() => setEditorOpen("main:raw")}
                            onStudio={() => openInStudio("main:raw", rawImage)}
                          />
                        )}
                        {transparentImage && (
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
                    <div className="sticky bottom-4 mt-6 flex justify-end">
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
        <footer className="mt-auto border-t border-border bg-muted/20 text-foreground pt-12 pb-8">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-display text-lg font-bold">
                  Digital Product Ai Automation
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                The ultimate tool for generating AI-powered, SEO-optimized digital product listings
                and ready-to-use print assets exclusively for Etsy and Adobe Stock sellers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Tools</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-foreground transition-colors">
                    Etsy Listing Generator
                  </Link>
                </li>
                <li>
                  <Link to="/adobe-stock" className="hover:text-foreground transition-colors">
                    Adobe Stock Studio
                  </Link>
                </li>
                <li>
                  <Link to="/keywords" className="hover:text-foreground transition-colors">
                    Keyword Research
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="hover:text-foreground transition-colors"
                  >
                    Settings & API Keys
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://www.etsy.com/sell"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    Etsy Seller Handbook
                  </a>
                </li>
                <li>
                  <a
                    href="https://contributor.stock.adobe.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    Adobe Stock Contributor
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-border text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} Digital Product Ai Automation. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Built exclusively for Etsy & Adobe Stock sellers.</p>
          </div>
        </footer>
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
        className={
          transparentBg
            ? "rounded-md border border-border bg-[conic-gradient(at_top_left,_#e5e7eb_25%,_transparent_25%,_transparent_50%,_#e5e7eb_50%,_#e5e7eb_75%,_transparent_75%)] bg-[length:20px_20px]"
            : ""
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
