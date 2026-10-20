// Self-contained Crochet Pattern Studio card.
// Generates: original pattern JSON + hero cover photo + 4 lifestyle mockups
// + Etsy SEO (title/description/tags) + premium PDF, then bundles into a ZIP.

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Download,
  RefreshCw,
  Sparkles,
  Wand2,
  FileText,
  AlertCircle,
  Copy,
  Check,
  Package,
} from "lucide-react";
import { CURATED_CROCHET_IDEAS, pickIdeas } from "@/lib/crochet/curated";
import { buildCrochetPdf, patternHash } from "@/lib/crochet/pdf";
import type { CrochetPattern } from "@/lib/crochet/types";

type ApiFn = <T>(url: string, body: unknown) => Promise<T>;

type Props = { apiCall: ApiFn; shopName?: string; shop?: Record<string, string> };

const HISTORY_KEY = "crochet:history";
const MAX_HISTORY = 200;

type SEO = { title: string; description: string; tags: string[] };
type MockupOut = { id: string; label: string; image: string };

const MOCKUP_PLAN: { id: string; label: string; filename: string }[] = [
  { id: "crochet-cover", label: "Text-overlay cover", filename: "01-cover.jpg" },
  { id: "crochet-lifestyle", label: "Lifestyle scene", filename: "02-lifestyle.jpg" },
  { id: "crochet-flatlay", label: "Styled flat-lay", filename: "03-flatlay.jpg" },
  { id: "crochet-detail", label: "Macro stitch detail", filename: "04-detail.jpg" },
  { id: "crochet-inuse", label: "In-use / worn", filename: "05-inuse.jpg" },
];

function loadHistory(): { hashes: string[]; titles: string[] } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { hashes: [], titles: [] };
    const j = JSON.parse(raw);
    return {
      hashes: Array.isArray(j.hashes) ? j.hashes : [],
      titles: Array.isArray(j.titles) ? j.titles : [],
    };
  } catch {
    return { hashes: [], titles: [] };
  }
}
function saveHistory(h: { hashes: string[]; titles: string[] }) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        hashes: h.hashes.slice(-MAX_HISTORY),
        titles: h.titles.slice(-MAX_HISTORY),
      }),
    );
  } catch {
    /* ignore */
  }
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "crochet-pattern"
  );
}

/** Load a base64 image (PNG/JPEG) into an HTMLImageElement. */
function loadImageFromB64(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    // sniff format
    const isJpeg = b64.startsWith("/9j/");
    img.src = `data:image/${isJpeg ? "jpeg" : "png"};base64,${b64}`;
  });
}

/** Resample a base64 image to `size` px on the longest side with high-quality smoothing.
 *  Returns a Blob in the requested format (png or jpg, quality 0.95 for jpg). */
async function resampleToBlob(b64: string, size: number, format: "png" | "jpg"): Promise<Blob> {
  const img = await loadImageFromB64(b64);
  const scale = size / Math.max(img.width, img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob>(
    (res) => canvas.toBlob((b) => res(b!), mime, format === "jpg" ? 0.95 : undefined)!,
  );
}

const RES_OPTIONS = [
  { px: 1024, label: "1024 px \u00b7 web" },
  { px: 2048, label: "2048 px \u00b7 hi-res" },
  { px: 3000, label: "3000 px \u00b7 print (300dpi \u224810in)" },
  { px: 4500, label: "4500 px \u00b7 large print" },
] as const;
type ResPx = (typeof RES_OPTIONS)[number]["px"];
type ImgFormat = "png" | "jpg";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function CrochetStudio({ apiCall, shopName, shop }: Props) {
  const [idea, setIdea] = useState("");
  const [terminology, setTerminology] = useState<"US" | "UK">("US");
  // Shuffle after mount: a random pick during render differs between server and client HTML.
  const [suggestions, setSuggestions] = useState<string[]>(() => CURATED_CROCHET_IDEAS.slice(0, 8));
  useEffect(() => setSuggestions(pickIdeas(8)), []);
  const [suggBusy, setSuggBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pattern, setPattern] = useState<CrochetPattern | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [mockups, setMockups] = useState<MockupOut[]>([]);
  const [seo, setSeo] = useState<SEO | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [countWarnings, setCountWarnings] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exportSizes, setExportSizes] = useState<ResPx[]>([2048, 3000]);
  const [exportFormat, setExportFormat] = useState<ImgFormat>("jpg");
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (zipUrl) URL.revokeObjectURL(zipUrl);
    },
    [pdfUrl, zipUrl],
  );

  const historyRef = useMemo(() => loadHistory(), []);

  function refreshCurated() {
    setSuggestions(pickIdeas(8));
  }
  async function refreshAI() {
    setSuggBusy(true);
    setErr(null);
    try {
      const r = await apiCall<{ ideas: string[] }>("/api/crochet-suggest", {});
      if (r.ideas?.length) setSuggestions(r.ideas.slice(0, 10));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSuggBusy(false);
    }
  }

  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function generate() {
    if (!idea.trim()) {
      setErr("Please enter or pick a pattern idea.");
      return;
    }
    setBusy(true);
    setErr(null);
    setPattern(null);
    setHero(null);
    setMockups([]);
    setSeo(null);
    setDupWarning(null);
    setCountWarnings([]);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    if (zipUrl) {
      URL.revokeObjectURL(zipUrl);
      setZipUrl(null);
    }

    try {
      // 1) Pattern JSON with dup-check retry
      const gen = async (seedSuffix = "") => {
        setStep("Designing an original pattern…");
        const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${seedSuffix}`;
        const r = await apiCall<{ pattern: CrochetPattern; warnings?: string[] }>(
          "/api/crochet-pattern",
          {
            idea,
            seed,
            terminology,
            avoidTitles: historyRef.titles.slice(-30),
          },
        );
        setCountWarnings(r.warnings ?? []);
        return r.pattern;
      };
      let p = await gen();
      const h1 = patternHash(p);
      if (historyRef.hashes.includes(h1)) {
        setStep("Duplicate detected — regenerating with a fresh seed…");
        const p2 = await gen("-retry");
        if (historyRef.hashes.includes(patternHash(p2))) {
          setDupWarning(
            "Similar pattern was generated before. Tweak the idea for even more uniqueness.",
          );
        }
        p = p2;
      }
      setPattern(p);

      // 2) Hero cover photo
      setStep("Rendering hero product photo…");
      let heroB64: string | null = null;
      try {
        const img = await apiCall<{ image: string }>("/api/adobe-stock-image", {
          prompt: `Beautifully styled finished crocheted product: ${p.title}. Professional Etsy product photo, natural window light, wooden or linen surface, cozy handmade craft aesthetic, crisp yarn texture, magazine-quality composition.`,
          mode: "jpeg",
          aspect: "3:2",
          hires: true,
        });
        heroB64 = img.image;
        setHero(heroB64);
      } catch (e) {
        console.warn("Hero image failed:", (e as Error).message);
      }

      // 3) SEO (title, description, tags)
      setStep("Writing Etsy title, description & tags…");
      try {
        const seoBody = {
          idea: `Crochet PATTERN PDF (digital download) — ${p.title}. ${p.subtitle}. Skill: ${p.skillLevel}. ${terminology} terminology. Finished size: ${p.finishedSize}. Includes materials list, abbreviations, row-by-row instructions, stitch chart, finishing & care.`,
          shop: shop ?? {},
          listingKind: "crochet-pattern",
        };
        const s = await apiCall<SEO>("/api/generate-seo", seoBody);
        setSeo(s);
      } catch (e) {
        console.warn("SEO failed:", (e as Error).message);
      }

      // 4) Mockups (in parallel, driven by hero)
      if (heroB64) {
        setStep("Generating listing mockups (cover + lifestyle + flat-lay + detail + in-use)…");
        const tasks = MOCKUP_PLAN.map(async (m) => {
          try {
            const tweak =
              m.id === "crochet-cover"
                ? `Product name to render on the right panel: "${p.title}". Feature bullets: "PDF pattern, instant download", "Stitch counts on every round", "${p.skillLevel} friendly". Use elegant serif italic for the product name.`
                : "";
            const r = await apiCall<{ image: string }>("/api/generate-mockup", {
              image: heroB64,
              mockup: m.id,
              tweak,
            });
            return { id: m.id, label: m.label, image: r.image } satisfies MockupOut;
          } catch (e) {
            console.warn(`Mockup ${m.id} failed:`, (e as Error).message);
            return null;
          }
        });
        const results = (await Promise.all(tasks)).filter(Boolean) as MockupOut[];
        setMockups(results);
      }

      // 5) Save history
      historyRef.hashes.push(patternHash(p));
      historyRef.titles.push(p.title);
      saveHistory(historyRef);

      // 6) Build PDF
      setStep("Building premium PDF…");
      const pdfBlob = await buildCrochetPdf(p, heroB64, shopName);
      setPdfUrl(URL.createObjectURL(pdfBlob));

      setStep("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Rebuild PDF if hero arrives after pattern (race safety)
  useEffect(() => {
    if (!pattern) return;
    (async () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const blob = await buildCrochetPdf(pattern, hero, shopName);
      setPdfUrl(URL.createObjectURL(blob));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero]);

  async function downloadZip() {
    if (!pattern) return;
    if (exportSizes.length === 0) {
      setErr("Pick at least one export resolution.");
      return;
    }
    setZipBusy(true);
    setErr(null);
    try {
      const zip = new JSZip();
      const base = slug(pattern.title);
      const folder = zip.folder(base)!;
      const pdfFolder = folder.folder("pdf")!;
      const imagesFolder = folder.folder("images")!;
      const mockupsFolder = folder.folder("mockups")!;
      const listingFolder = folder.folder("listing")!;

      const index: { path: string; bytes: number; note?: string }[] = [];
      const track = (path: string, blobOrStr: Blob | string, note?: string) => {
        const bytes = typeof blobOrStr === "string" ? new Blob([blobOrStr]).size : blobOrStr.size;
        index.push({ path, bytes, note });
      };

      // --- PDF
      const pdfBlob = await buildCrochetPdf(pattern, hero, shopName);
      const pdfName = `${base}-pattern.pdf`;
      pdfFolder.file(pdfName, pdfBlob);
      track(`pdf/${pdfName}`, pdfBlob, "Print-ready A4 pattern PDF");

      // --- Hero image at every selected size
      const ext = exportFormat;
      // (mime derived from ext inside resampleToBlob)
      if (hero) {
        for (const size of exportSizes) {
          const b = await resampleToBlob(hero, size, ext);
          const name = `hero-${size}px.${ext}`;
          imagesFolder.file(name, b);
          track(`images/${name}`, b, `Cover product photo · ${size}px`);
        }
      }

      // --- Mockups: one sub-folder per resolution, all selected sizes included
      for (const size of exportSizes) {
        const sub = mockupsFolder.folder(`${size}px`)!;
        for (const m of mockups) {
          const plan = MOCKUP_PLAN.find((x) => x.id === m.id);
          const stem = (plan?.filename ?? `${m.id}.jpg`).replace(/\.(jpg|jpeg|png)$/i, "");
          const b = await resampleToBlob(m.image, size, ext);
          const name = `${stem}.${ext}`;
          sub.file(name, b);
          track(`mockups/${size}px/${name}`, b, `${plan?.label ?? m.id} · ${size}px`);
        }
      }

      // --- Etsy listing (txt + json)
      if (seo) {
        const listing = [
          `TITLE (${seo.title.length} chars):`,
          seo.title,
          "",
          "TAGS (Etsy \u2014 13 max):",
          seo.tags.join(", "),
          "",
          "DESCRIPTION:",
          seo.description,
        ].join("\n");
        listingFolder.file("etsy-listing.txt", listing);
        listingFolder.file("etsy-listing.json", JSON.stringify(seo, null, 2));
        track("listing/etsy-listing.txt", listing, "SEO title, tags, description");
        track("listing/etsy-listing.json", JSON.stringify(seo, null, 2));
      }

      // --- Source pattern JSON
      const patternJson = JSON.stringify(pattern, null, 2);
      folder.file("pattern.json", patternJson);
      track("pattern.json", patternJson, "Source pattern data");

      // --- README / index
      const readme = [
        `# ${pattern.title}`,
        pattern.subtitle ?? "",
        "",
        `Skill: ${pattern.skillLevel} · Terms: ${pattern.terminology} · Size: ${pattern.finishedSize}`,
        "",
        "## Folder structure",
        "- pdf/          Print-ready pattern PDF (A4, 300 DPI vector text)",
        `- images/       Cover product photo (${exportSizes.join(", ")}px, .${ext})`,
        `- mockups/      Listing mockups grouped by resolution (${exportSizes.map((s) => s + "px").join(", ")})`,
        "- listing/      Etsy title, tags and description",
        "- pattern.json  Source data",
        "",
        "## Files",
        ...index
          .sort((a, b) => a.path.localeCompare(b.path))
          .map(
            (f) => `- ${f.path}  \u2014  ${fmtBytes(f.bytes)}${f.note ? "  (" + f.note + ")" : ""}`,
          ),
        "",
        `Generated by ${shopName ?? "Crochet Studio"} \u2014 ${new Date().toISOString()}`,
      ].join("\n");
      folder.file("README.txt", readme);

      // machine-readable index
      folder.file(
        "index.json",
        JSON.stringify(
          {
            title: pattern.title,
            sizes: exportSizes,
            format: ext,
            files: index,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      if (zipUrl) URL.revokeObjectURL(zipUrl);
      const url = URL.createObjectURL(blob);
      setZipUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}-etsy-package.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setZipBusy(false);
    }
  }

  const pdfName = pattern ? `${slug(pattern.title)}-pattern.pdf` : "crochet-pattern.pdf";

  return (
    <Card className="mt-6 border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" /> Crochet Pattern Studio
          <Badge variant="secondary" className="ml-2">
            Etsy PDF + mockups + SEO
          </Badge>
        </CardTitle>
        <CardDescription>
          Generates an original crochet pattern, a premium PDF (cover, materials, abbreviations,
          row-by-row instructions, stitch chart, finishing & care), a text-overlay cover image plus
          4 lifestyle mockups, and a complete Etsy title / description / tags — bundled into one
          ZIP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggestions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm">Suggested ideas</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={refreshCurated} disabled={busy}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Shuffle curated
              </Button>
              <Button size="sm" variant="outline" onClick={refreshAI} disabled={busy || suggBusy}>
                {suggBusy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                )}
                AI fresh ideas
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setIdea(s)}
                disabled={busy}
                className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs hover:border-primary hover:bg-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Idea input */}
        <div>
          <Label htmlFor="crochet-idea">Pattern idea</Label>
          <Textarea
            id="crochet-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. Nautilus shell handbag with gold shell charm"
            rows={2}
            disabled={busy}
            className="mt-1.5"
          />
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Terminology:</span>
            {(["US", "UK"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={terminology === t}
                  onChange={() => setTerminology(t)}
                  disabled={busy}
                />
                {t}
              </label>
            ))}
            <span className="ml-auto text-muted-foreground">
              History: {historyRef.hashes.length} unique patterns
            </span>
          </div>
        </div>

        {/* Export resolution + format selector */}
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Export sizes
            </Label>
            <span className="text-[11px] text-muted-foreground">
              (each selected size is included in the ZIP)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RES_OPTIONS.map((r) => {
              const active = exportSizes.includes(r.px);
              return (
                <button
                  key={r.px}
                  type="button"
                  disabled={busy || zipBusy}
                  onClick={() =>
                    setExportSizes((prev) =>
                      prev.includes(r.px)
                        ? prev.filter((x) => x !== r.px)
                        : [...prev, r.px].sort((a, b) => a - b),
                    )
                  }
                  className={
                    "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/60 hover:border-primary")
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Format:</span>
            {(["jpg", "png"] as const).map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  checked={exportFormat === f}
                  onChange={() => setExportFormat(f)}
                  disabled={busy || zipBusy}
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={busy || !idea.trim()}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Generate full Etsy package
          </Button>
          {pdfUrl && (
            <Button variant="outline" asChild>
              <a href={pdfUrl} download={pdfName}>
                <Download className="mr-2 h-4 w-4" /> PDF only
              </a>
            </Button>
          )}
          {pattern && (
            <Button
              variant="default"
              onClick={downloadZip}
              disabled={busy || zipBusy || exportSizes.length === 0}
            >
              {zipBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              {zipBusy
                ? "Packaging ZIP…"
                : `Download ZIP (${exportSizes.length} size${exportSizes.length === 1 ? "" : "s"})`}
            </Button>
          )}
        </div>

        {busy && step && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
          </p>
        )}
        {err && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>{err}</div>
          </div>
        )}
        {dupWarning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>{dupWarning}</div>
          </div>
        )}
        {pattern && countWarnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">
                Check these rounds before listing ({countWarnings.length}), or generate again:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {countWarnings.slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {pattern && (
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
            <p className="font-medium">Before you list on Etsy</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>
                Crochet a test sample first. A photo of your real finished piece sells best and
                proves the pattern works.
              </li>
              <li>
                The AI photos are renders: keep the note in the description saying so, and add your
                own photo as the first image when you can.
              </li>
              <li>
                In the listing, set “Who made it” to “I did” (you designed the pattern) and leave
                the AI disclosure line in the description.
              </li>
              <li>
                Don&apos;t add brand, character or celebrity names to the title or tags, even in a
                tag like “inspired by”.
              </li>
            </ul>
          </div>
        )}

        {/* Result: pattern summary */}
        {pattern && (
          <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
              {hero ? (
                <img
                  src={`data:image/jpeg;base64,${hero}`}
                  alt={pattern.title}
                  className="w-full rounded-md"
                />
              ) : (
                <div className="flex aspect-[3/2] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  Cover rendering…
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold leading-tight">{pattern.title}</h3>
              <p className="italic text-muted-foreground">{pattern.subtitle}</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">Skill: {pattern.skillLevel}</Badge>
                <Badge variant="outline">{pattern.terminology} terms</Badge>
                {pattern.finishedSize && <Badge variant="outline">{pattern.finishedSize}</Badge>}
                <Badge variant="outline">{pattern.sections?.length ?? 0} sections</Badge>
                <Badge variant="outline">
                  {(pattern.sections ?? []).reduce((n, s) => n + (s.rows?.length ?? 0), 0)} rows
                </Badge>
                {pattern.chartRounds?.length ? (
                  <Badge variant="outline">Stitch chart ✓</Badge>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Mockup gallery */}
        {mockups.length > 0 && (
          <div className="mt-2">
            <Label className="mb-2 block text-sm">Listing mockups</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {mockups.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="overflow-hidden rounded-md border border-border/60 bg-muted/30">
                    <img
                      src={`data:image/jpeg;base64,${m.image}`}
                      alt={m.label}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEO panel */}
        {seo && (
          <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-background/50 p-3">
            <SeoField
              id="title"
              label={`Title (${seo.title.length} chars)`}
              value={seo.title}
              onCopy={copy}
              copied={copied}
            >
              <Input value={seo.title} readOnly className="text-sm" />
            </SeoField>
            <SeoField
              id="tags"
              label={`Tags (${seo.tags.length}/13)`}
              value={seo.tags.join(", ")}
              onCopy={copy}
              copied={copied}
            >
              <div className="flex flex-wrap gap-1.5">
                {seo.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            </SeoField>
            <SeoField
              id="desc"
              label="Description"
              value={seo.description}
              onCopy={copy}
              copied={copied}
            >
              <Textarea readOnly value={seo.description} rows={10} className="font-mono text-xs" />
            </SeoField>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeoField({
  id,
  label,
  value,
  onCopy,
  copied,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onCopy: (id: string, v: string) => void;
  copied: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => onCopy(id, value)}>
          {copied === id ? (
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
