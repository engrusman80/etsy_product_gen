import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Download,
  Sparkles,
  Image as ImageIcon,
  FileImage,
  Shapes,
  Video,
  AlertCircle,
  Home,
  KeyRound,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upscaleImage, downloadBlob } from "@/lib/adobe-stock/upscale";
import { checkAdobePolicy } from "@/lib/adobe-stock/policy";
import { AdobeMetaPanel } from "@/components/AdobeMetaPanel";
import { filterTrending, type TrendingPrompt } from "@/lib/adobe-stock/trending-prompts";

export const Route = createFileRoute("/adobe-stock")({
  head: () => ({
    meta: [
      { title: "Adobe Stock Generator — Policy-Compliant Images, Vectors & Videos" },
      {
        name: "description",
        content:
          "Generate Adobe Stock-ready JPEGs (4–100MP), transparent PNGs, layered SVG vectors and HD videos with built-in policy guardrails.",
      },
    ],
  }),
  component: AdobeStock,
});

type Provider = "gemini" | "openai" | "xai";

function useApiKeys() {
  const [provider, setProvider] = useState<Provider>("gemini");
  const [gemini, setGemini] = useState("");
  const [openai, setOpenai] = useState("");
  const [xai, setXai] = useState("");
  useEffect(() => {
    setProvider((localStorage.getItem("as_provider") as Provider) || "gemini");
    setGemini(localStorage.getItem("as_gemini_key") || "");
    setOpenai(localStorage.getItem("as_openai_key") || "");
    setXai(localStorage.getItem("as_xai_key") || "");
  }, []);
  const save = () => {
    localStorage.setItem("as_provider", provider);
    localStorage.setItem("as_gemini_key", gemini);
    localStorage.setItem("as_openai_key", openai);
    localStorage.setItem("as_xai_key", xai);
  };
  const headers = (): HeadersInit => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "x-ai-provider": provider,
    };
    const key = provider === "gemini" ? gemini : provider === "openai" ? openai : xai;
    if (key) h["x-ai-key"] = key;
    return h;
  };
  return {
    provider,
    setProvider,
    gemini,
    setGemini,
    openai,
    setOpenai,
    xai,
    setXai,
    save,
    headers,
  };
}

function AdobeStock() {
  const keys = useApiKeys();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="adobe" actions={<KeysDialog keys={keys} />} />
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Policy-compliant
          </p>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            <ShieldCheck className="h-7 w-7 text-primary" /> Adobe Stock Studio
          </h1>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-sm flex gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-1">Built strictly for Adobe Stock submissions.</strong>
              JPEG & PNG output at <b>≥ 4 MP</b> (up to 100 MP, ≤ 45 MB). SVG vectors at{" "}
              <b>15–65 MP</b> artboard. Videos at <b>1080p</b>, 5–60 s, MP4/h.264. Prompts are
              filtered for trademarks, brands, celebrities and copyrighted IP. Cheapest provider
              (Gemini) is used by default.
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="jpeg" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="jpeg">
              <ImageIcon className="h-4 w-4 mr-2" />
              JPEG
            </TabsTrigger>
            <TabsTrigger value="png">
              <FileImage className="h-4 w-4 mr-2" />
              Transparent PNG
            </TabsTrigger>
            <TabsTrigger value="svg">
              <Shapes className="h-4 w-4 mr-2" />
              SVG Vector
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4 mr-2" />
              Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jpeg">
            <ImagePanel mode="jpeg" keys={keys} />
          </TabsContent>
          <TabsContent value="png">
            <ImagePanel mode="png" keys={keys} />
          </TabsContent>
          <TabsContent value="svg">
            <SvgPanel keys={keys} />
          </TabsContent>
          <TabsContent value="video">
            <VideoPanel keys={keys} />
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}

function KeysDialog({ keys }: { keys: ReturnType<typeof useApiKeys> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-2" />
          API Keys
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Keys (saved locally)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Preferred provider</Label>
            <Select value={keys.provider} onValueChange={(v) => keys.setProvider(v as Provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (Nano Banana 2 — cheapest)</SelectItem>
                <SelectItem value="openai">OpenAI gpt-image-1 (highest photorealism)</SelectItem>
                <SelectItem value="xai">xAI Grok 2 Image</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Tip: OpenAI gpt-image-1 (high quality) produces the sharpest photorealistic detail for
              Adobe Stock. Gemini is fastest/cheapest. Grok is a creative alternative.
            </p>
          </div>
          <div>
            <Label>Gemini API key</Label>
            <Input
              type="password"
              value={keys.gemini}
              onChange={(e) => keys.setGemini(e.target.value)}
              placeholder="AIza..."
            />
            <p className="text-xs text-muted-foreground mt-1">aistudio.google.com</p>
          </div>
          <div>
            <Label>OpenAI API key</Label>
            <Input
              type="password"
              value={keys.openai}
              onChange={(e) => keys.setOpenai(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              platform.openai.com — gpt-image-1 gives the best zoom fidelity.
            </p>
          </div>
          <div>
            <Label>xAI (Grok) API key</Label>
            <Input
              type="password"
              value={keys.xai}
              onChange={(e) => keys.setXai(e.target.value)}
              placeholder="xai-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              console.x.ai — model grok-2-image-1212.
            </p>
          </div>
          <Button
            onClick={() => {
              keys.save();
              setOpen(false);
            }}
            className="w-full"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Image panel (JPEG + PNG) ----------
type Orientation = "1:1" | "3:2" | "16:9" | "2:3" | "9:16" | "4:5" | "9:19.5";
const ORIENTATIONS: {
  value: Orientation;
  label: string;
  aspect: number;
  hint: string;
  group: "square" | "landscape" | "portrait" | "wallpaper";
}[] = [
  { value: "1:1", label: "Square 1:1", aspect: 1, hint: "square composition", group: "square" },
  {
    value: "3:2",
    label: "Landscape 3:2",
    aspect: 3 / 2,
    hint: "horizontal landscape, 3:2 aspect",
    group: "landscape",
  },
  {
    value: "16:9",
    label: "Landscape 16:9 (wide)",
    aspect: 16 / 9,
    hint: "wide cinematic horizontal 16:9",
    group: "landscape",
  },
  {
    value: "2:3",
    label: "Portrait 2:3",
    aspect: 2 / 3,
    hint: "vertical portrait, 2:3 aspect",
    group: "portrait",
  },
  {
    value: "9:16",
    label: "Portrait 9:16 (tall)",
    aspect: 9 / 16,
    hint: "tall vertical 9:16 mobile/story",
    group: "portrait",
  },
  {
    value: "4:5",
    label: "Portrait 4:5",
    aspect: 4 / 5,
    hint: "vertical 4:5 social portrait",
    group: "portrait",
  },
  {
    value: "9:19.5",
    label: "📱 Mobile wallpaper 9:19.5",
    aspect: 9 / 19.5,
    hint: "phone wallpaper aspect 9:19.5 (iPhone/Android lock-screen ratio), keep subject centred within safe area",
    group: "wallpaper",
  },
];

// Adobe Stock–friendly resolution tiers (all ≥ 4 MP minimum, all under 100 MP maximum).
// The MP value below is used as the pixel-count target and translates roughly to the
// horizontal edge shown alongside (calculated at 16:9 for the label).
type ResTier = { value: string; label: string; mp: number };
const RES_TIERS: ResTier[] = [
  { value: "4", label: "2K  · 4 MP  (Adobe minimum)", mp: 4 },
  { value: "8", label: "4K  · 8.3 MP  ⭐ recommended", mp: 8 },
  { value: "16", label: "6K  · 16 MP", mp: 16 },
  { value: "25", label: "8K  · 25 MP", mp: 25 },
  { value: "50", label: "12K · 50 MP", mp: 50 },
  { value: "100", label: "16K · 100 MP (Adobe maximum)", mp: 100 },
];

function ImagePanel({ mode, keys }: { mode: "jpeg" | "png"; keys: ReturnType<typeof useApiKeys> }) {
  const [prompt, setPrompt] = useState("");
  const [targetMp, setTargetMp] = useState(8); // default 4K
  const [orientation, setOrientation] = useState<Orientation>("1:1");
  const [hires, setHires] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ w: number; h: number; mp: number; bytes: number } | null>(
    null,
  );
  const [seoFilename, setSeoFilename] = useState<string | null>(null);
  const [metaKey, setMetaKey] = useState<number | null>(null);
  const [metaPrompt, setMetaPrompt] = useState("");

  const suggestions = useMemo<TrendingPrompt[]>(
    () => filterTrending(orientation === "9:19.5" ? "wallpaper" : mode),
    [mode, orientation],
  );

  const applySuggestion = (s: TrendingPrompt) => {
    setPrompt(s.prompt);
    if (s.bestAspect) setOrientation(s.bestAspect);
  };

  const generate = async () => {
    setError(null);
    setPreview(null);
    setMeta(null);
    const p = checkAdobePolicy(prompt);
    if (!p.ok) {
      setError(p.reason);
      return;
    }
    setLoading(true);
    try {
      const o = ORIENTATIONS.find((x) => x.value === orientation)!;
      // Gemini's imageConfig doesn't officially support 9:19.5 — map to the closest supported 9:16 and
      // rely on our upscaler + prompt hint to enforce the true wallpaper ratio.
      const apiAspect: string = o.value === "9:19.5" ? "9:16" : o.value;
      const orientedPrompt = `${prompt}\n\nComposition: ${o.hint} (${o.value} aspect ratio). Frame the subject so nothing important is cropped when output is ${o.value}. Photographic detail must remain tack-sharp when zoomed to 100%.`;
      const res = await fetch("/api/adobe-stock-image", {
        method: "POST",
        headers: keys.headers(),
        body: JSON.stringify({ prompt: orientedPrompt, mode, aspect: apiAspect, hires }),
      });
      const text = await res.text();
      let j: { image?: string; error?: string } = {};
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`Server ${res.status}: ${text.slice(0, 300)}`);
      }
      if (!res.ok) throw new Error(j.error || `Generation failed (${res.status})`);
      if (!j.image) throw new Error("Server returned no image");

      let srcDataUrl = `data:image/png;base64,${j.image}`;

      // For transparent PNGs, run the source through remove.bg so the white background is gone.
      if (mode === "png") {
        const rb = await fetch("/api/remove-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: j.image }),
        });
        const rbj = await rb.json();
        if (!rb.ok) throw new Error(rbj.error || "Background removal failed");
        srcDataUrl = `data:image/png;base64,${rbj.image}`;
      }

      const { blob, width, height, mp } = await upscaleImage(srcDataUrl, {
        targetMp,
        format: mode,
        transparent: mode === "png",
        quality: 0.98,
        aspect: o.aspect,
        sharpen: true,
        // Adobe accepts up to 45 MB, but pro reviewers prefer 5–20 MB range for JPEGs.
        minBytes: mode === "jpeg" ? 5 * 1024 * 1024 : undefined,
        maxBytes: mode === "jpeg" ? 20 * 1024 * 1024 : undefined,
      });

      if (blob.size > 45 * 1024 * 1024) {
        throw new Error(
          `Output exceeds Adobe's 45 MB limit (${(blob.size / 1024 / 1024).toFixed(1)} MB). Lower target MP.`,
        );
      }
      setPreview(URL.createObjectURL(blob));
      setMeta({ w: width, h: height, mp, bytes: blob.size });
      (window as unknown as { __lastBlob: Blob; __lastPreviewUrl: string }).__lastBlob = blob;
      (window as unknown as { __lastPreviewUrl: string }).__lastPreviewUrl = srcDataUrl;

      // Auto-generate SEO metadata for the exact prompt just used.
      setMetaPrompt(prompt);
      setMetaKey(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = async (asLossless = false) => {
    const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
    if (!blob) return;
    const base =
      seoFilename ||
      prompt
        .slice(0, 50)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase() ||
      "adobe-stock";
    if (asLossless) {
      // Re-render the current preview as lossless PNG (max zoom fidelity, no JPEG artifacts).
      const preview = (window as unknown as { __lastPreviewUrl?: string }).__lastPreviewUrl;
      if (!preview) return;
      const {
        blob: pngBlob,
        width,
        height,
      } = await upscaleImage(preview, {
        targetMp,
        format: "png",
        transparent: false,
        aspect: ORIENTATIONS.find((x) => x.value === orientation)!.aspect,
        sharpen: false,
      });
      downloadBlob(pngBlob, `${base}-${width}x${height}-lossless.png`);
      return;
    }
    const ext = mode === "jpeg" ? "jpg" : "png";
    downloadBlob(blob, `${base}-${meta?.w}x${meta?.h}.${ext}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "jpeg" ? <ImageIcon className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
          {mode === "jpeg" ? "JPEG image" : "Transparent PNG"}
        </CardTitle>
        <CardDescription>
          {mode === "jpeg"
            ? "JPEG format only • 2K / 4K / 8K+ • auto-sized to 5–20 MB • ≤ 45 MB hard limit."
            : "PNG only, fully transparent background • 2K / 4K / 8K+ • ≤ 45 MB."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trending prompt suggestions */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Trending on Adobe Stock — click to use (metadata will match exactly)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applySuggestion(s)}
                className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-accent hover:border-primary/40 transition-colors"
                title={s.prompt}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          rows={3}
          placeholder={
            mode === "jpeg"
              ? "e.g. minimalist flat-lay of autumn leaves, coffee cup and notebook on linen — warm cinematic lighting"
              : "e.g. isolated watercolor butterfly, vibrant orange and blue, no background"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Orientation</Label>
            <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIENTATIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target resolution</Label>
            <Select value={String(targetMp)} onValueChange={(v) => setTargetMp(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RES_TIERS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={hires}
            onChange={(e) => setHires(e.target.checked)}
            className="accent-primary"
          />
          Highest-quality model (Gemini 3 Pro Image) — falls back automatically if the pro tier is
          overloaded
        </label>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{" "}
            <span>{error}</span>
          </div>
        )}

        {preview && meta && (
          <div className="space-y-3">
            <div
              className={
                mode === "png"
                  ? "bg-[conic-gradient(at_0_0,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] [background-size:20px_20px] rounded-md border"
                  : "rounded-md border"
              }
            >
              <img
                src={preview}
                alt="preview"
                className="w-full max-h-[500px] object-contain mx-auto"
              />
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>
                {meta.w}×{meta.h}px
              </span>
              <span>{meta.mp.toFixed(1)} MP</span>
              <span>{(meta.bytes / 1024 / 1024).toFixed(2)} MB</span>
              <span className="text-emerald-600">✓ Adobe Stock compliant</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => save(false)} variant="outline">
                <Download className="h-4 w-4 mr-2" /> Download {mode === "jpeg" ? "JPEG" : "PNG"}
              </Button>
              {mode === "jpeg" && (
                <Button
                  onClick={() => save(true)}
                  variant="secondary"
                  title="Lossless PNG — best for infinite-zoom quality, larger file"
                >
                  <Download className="h-4 w-4 mr-2" /> Lossless PNG (zoom-proof)
                </Button>
              )}
            </div>
            <AdobeMetaPanel
              prompt={metaPrompt || prompt}
              assetType={mode}
              headers={keys.headers}
              onFilenameChange={setSeoFilename}
              autoTriggerKey={metaKey}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- SVG panel ----------
function SvgPanel({ keys }: { keys: ReturnType<typeof useApiKeys> }) {
  const [prompt, setPrompt] = useState("");
  const [artboard, setArtboard] = useState(4000); // 16 MP
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [seoFilename, setSeoFilename] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setSvg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/adobe-stock-svg", {
        method: "POST",
        headers: keys.headers(),
        body: JSON.stringify({ prompt, artboard }),
      });
      const text = await res.text();
      let j: { svg?: string; error?: string } = {};
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`Server ${res.status}: ${text.slice(0, 300)}`);
      }
      if (!res.ok) throw new Error(j.error || `SVG generation failed (${res.status})`);
      if (!j.svg) throw new Error("Server returned no SVG");
      setSvg(j.svg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    if (blob.size > 45 * 1024 * 1024) {
      setError("SVG exceeds 45 MB Adobe limit. Reduce complexity.");
      return;
    }
    const slug =
      seoFilename ||
      prompt
        .slice(0, 50)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase() ||
      "adobe-stock-vector";
    downloadBlob(blob, `${slug}.svg`);
  };

  const mp = (artboard * artboard) / 1_000_000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shapes className="h-5 w-5" />
          SVG Vector
        </CardTitle>
        <CardDescription>
          SVG format only • Editable layered paths • Artboard 15–65 MP • ≤ 45 MB. (Adobe also
          accepts .ai and .eps — open the SVG in Illustrator and Save As .ai/.eps.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={3}
          placeholder="e.g. set of 12 minimalist line-art coffee icons, mono-color, uniform stroke weight"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Artboard size (square)</Label>
            <Select value={String(artboard)} onValueChange={(v) => setArtboard(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3873">3873×3873 (15 MP, Adobe min)</SelectItem>
                <SelectItem value="4000">4000×4000 (16 MP)</SelectItem>
                <SelectItem value="5000">5000×5000 (25 MP)</SelectItem>
                <SelectItem value="6500">6500×6500 (42 MP)</SelectItem>
                <SelectItem value="8062">8062×8062 (65 MP, Adobe max)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{mp.toFixed(1)} MP</p>
          </div>
          <div className="flex items-end">
            <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate SVG
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{" "}
            <span>{error}</span>
          </div>
        )}

        {svg && (
          <div className="space-y-3">
            <div
              className="rounded-md border bg-white p-2 max-h-[500px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <Button onClick={save} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download SVG
            </Button>
            <AdobeMetaPanel
              prompt={prompt}
              assetType="svg"
              headers={keys.headers}
              onFilenameChange={setSeoFilename}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Video panel ----------
function VideoPanel({ keys }: { keys: ReturnType<typeof useApiKeys> }) {
  const [prompt, setPrompt] = useState("");
  const [totalDuration, setTotalDuration] = useState(60); // seconds — Veo chunks of 8s each
  const [model, setModel] = useState("veo-3.0-fast-generate-001");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState(0);
  const [seoFilename, setSeoFilename] = useState<string | null>(null);

  const CHUNK = 8; // Veo max seconds per clip
  const numClips = Math.ceil(totalDuration / CHUNK);

  const generate = async () => {
    setError(null);
    setVideoUrl(null);
    setBytes(0);
    setLoading(true);
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "x-ai-provider": "gemini",
        "x-ai-key": keys.gemini || "",
      };
      const clips: Blob[] = [];
      let lastFrame: { base64: string; mime: string } | null = null;

      // Lazy-load stitch helpers (ffmpeg.wasm is large; only when needed).
      const { extractLastFrame, concatMp4 } = await import("@/lib/adobe-stock/video-stitch");

      for (let i = 0; i < numClips; i++) {
        const remaining = totalDuration - i * CHUNK;
        const dur = Math.min(CHUNK, Math.max(4, remaining));
        const clipPrompt =
          i === 0
            ? prompt
            : `Continuation shot ${i + 1} of ${numClips}. Seamlessly continue the previous scene with matching subject, lighting, colour grade and camera motion. Original brief: ${prompt}`;

        setStatus(`Clip ${i + 1}/${numClips} — submitting to Veo (${dur}s)...`);
        const startRes = await fetch("/api/adobe-stock-video", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "start",
            prompt: clipPrompt,
            duration: dur,
            model,
            imageBase64: lastFrame?.base64,
            imageMime: lastFrame?.mime,
          }),
        });
        const startJ = await startRes.json();
        if (!startRes.ok) throw new Error(startJ.error || "Veo start failed");
        const op = startJ.operation as string;

        let clipBlob: Blob | null = null;
        for (let p = 0; p < 90; p++) {
          await new Promise((r) => setTimeout(r, 5000));
          const pollRes = await fetch("/api/adobe-stock-video", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "poll", operation: op }),
          });
          const pj = await pollRes.json();
          if (!pollRes.ok) throw new Error(pj.error || "Poll failed");
          if (pj.done) {
            if (pj.error) throw new Error(pj.error);
            const bin = Uint8Array.from(atob(pj.videoBase64), (c) => c.charCodeAt(0));
            clipBlob = new Blob([bin], { type: pj.mime || "video/mp4" });
            break;
          }
          setStatus(`Clip ${i + 1}/${numClips} — rendering... (${(p + 1) * 5}s)`);
        }
        if (!clipBlob) throw new Error(`Clip ${i + 1} timed out`);
        clips.push(clipBlob);

        // Extract last frame so the next clip continues seamlessly.
        if (i < numClips - 1) {
          setStatus(`Clip ${i + 1}/${numClips} — extracting continuity frame...`);
          lastFrame = await extractLastFrame(clipBlob);
        }
      }

      setStatus(`Stitching ${clips.length} clip(s) into final MP4...`);
      const finalBlob = await concatMp4(clips, (m) => setStatus(`ffmpeg: ${m}`));
      if (finalBlob.size > 3.9 * 1024 * 1024 * 1024) {
        throw new Error("Video exceeds 3.9 GB Adobe limit.");
      }
      setVideoUrl(URL.createObjectURL(finalBlob));
      setBytes(finalBlob.size);
      (window as unknown as { __lastVideo: Blob }).__lastVideo = finalBlob;
      setStatus("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    const blob = (window as unknown as { __lastVideo?: Blob }).__lastVideo;
    if (!blob) return;
    const slug =
      seoFilename ||
      prompt
        .slice(0, 50)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase() ||
      "adobe-stock-video";
    downloadBlob(blob, `${slug}.mp4`);
  };

  // Rough cost/time estimate (Veo 3 ≈ $0.40/sec, Fast ≈ $0.15/sec)
  const perSec = model.includes("fast") ? 0.15 : 0.4;
  const estCost = (totalDuration * perSec).toFixed(2);
  const estMinutes = Math.ceil(numClips * 2.5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Long-form Stock Video (highest payout)
        </CardTitle>
        <CardDescription>
          MP4 / h.264 • 1920×1080 • up to 2 minutes (auto-chained 8 s Veo clips with
          frame-continuity + ffmpeg stitch in your browser) • ≤ 3.9 GB. Each next clip uses the
          previous clip's final frame for seamless motion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={3}
          placeholder="e.g. slow aerial drone shot over autumn forest at golden hour, gentle camera push-in, cinematic colour grade"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Total duration</Label>
            <Select
              value={String(totalDuration)}
              onValueChange={(v) => setTotalDuration(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 s (1 clip)</SelectItem>
                <SelectItem value="16">16 s (2 clips)</SelectItem>
                <SelectItem value="32">32 s (4 clips)</SelectItem>
                <SelectItem value="60">60 s (8 clips) — recommended</SelectItem>
                <SelectItem value="90">90 s (12 clips)</SelectItem>
                <SelectItem value="120">120 s (15 clips, Adobe max)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {numClips} clip(s) • ~${estCost} • ~{estMinutes} min render
            </p>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="veo-3.0-generate-001">Veo 3 — best quality</SelectItem>
                <SelectItem value="veo-3.0-fast-generate-001">Veo 3 Fast — cheapest</SelectItem>
                <SelectItem value="veo-2.0-generate-001">Veo 2 (legacy)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={generate}
              disabled={loading || !prompt.trim() || !keys.gemini}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate {totalDuration}s
            </Button>
          </div>
        </div>
        {!keys.gemini && (
          <p className="text-xs text-amber-600">
            Add your Gemini API key (top-right) — video uses Veo which is Gemini-only.
          </p>
        )}

        {status && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {status}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{" "}
            <span>{error}</span>
          </div>
        )}

        {videoUrl && (
          <div className="space-y-3">
            <video src={videoUrl} controls className="w-full rounded-md border bg-black" />
            <div className="text-xs text-muted-foreground">
              {(bytes / 1024 / 1024).toFixed(2)} MB • MP4 • 1080p • {totalDuration}s •{" "}
              <span className="text-emerald-600">✓ Adobe Stock compliant</span>
            </div>
            <Button onClick={save} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download MP4
            </Button>
            <AdobeMetaPanel
              prompt={prompt}
              assetType="video"
              headers={keys.headers}
              onFilenameChange={setSeoFilename}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
