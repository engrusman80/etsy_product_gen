import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Download,
  FileImage,
  FileText,
  Image as ImageIcon,
  Layers,
  PenTool,
  ShieldCheck,
  Shirt,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";
import { Button } from "./ui/button";
import { PRODUCT_TYPES, type ProductTypeId } from "@/lib/product-types";

const DELIVERABLES = [
  {
    icon: ImageIcon,
    title: "Native 4K artwork",
    body: "4096 × 4096 px designs rendered at full resolution, stamped at 300 DPI for crisp prints.",
  },
  {
    icon: Layers,
    title: "Transparent PNG",
    body: "Clean cut-outs ready for sublimation, stickers and print-on-demand, plus a white-background JPG.",
  },
  {
    icon: PenTool,
    title: "SVG & DXF cut files",
    body: "Real vector paths that open in Cricut Design Space and Silhouette Studio.",
  },
  {
    icon: FileText,
    title: "PDF, EPS & AI",
    body: "Print-sized documents for buyers who work in Illustrator or send files to a print shop.",
  },
  {
    icon: Shirt,
    title: "Realistic mockups",
    body: "T-shirts, mugs, frames, tote bags and more, so your listing photos are done too.",
  },
  {
    icon: Tags,
    title: "SEO listing copy",
    body: "A title, description and 13 tags written for Etsy search, ready to paste.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a type and describe it",
    body: "Choose a sticker sheet, wall art, coloring page or any other type, then type an idea or paste up to ten for a batch.",
  },
  {
    n: "02",
    title: "Review and refine",
    body: "Check the artwork, regenerate any mockup, or fine-tune it in the built-in Image Studio.",
  },
  {
    n: "03",
    title: "Download one ZIP",
    body: "Every file and the listing text arrive in one organised folder, ready to upload.",
  },
];

function FileChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 font-mono text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

/** A static preview of what one generated product looks like. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -left-6 -top-6 hidden h-24 w-24 rounded-full bg-sage/25 blur-2xl sm:block" />
      <div className="absolute -bottom-8 -right-4 hidden h-28 w-28 rounded-full bg-primary/25 blur-2xl sm:block" />

      <div className="paper-card relative rotate-[-1.5deg] p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">cute-cat-tshirt / design</span>
          <span className="rounded-full bg-sage/15 px-2 py-0.5 font-medium text-sage">Ready</span>
        </div>
        <div className="paper-dots mt-3 grid aspect-square place-items-center rounded-xl border border-dashed border-border bg-paper">
          <svg viewBox="0 0 200 200" className="h-3/4 w-3/4" aria-hidden>
            <path d="M58 86 64 34l38 34" fill="#d9a441" />
            <path d="M142 86 136 34 98 68" fill="#d9a441" />
            <ellipse cx="100" cy="112" rx="62" ry="56" fill="#d9a441" />
            <circle cx="78" cy="104" r="12" fill="#fff" />
            <circle cx="122" cy="104" r="12" fill="#fff" />
            <circle cx="80" cy="106" r="6" fill="#1f1a17" />
            <circle cx="124" cy="106" r="6" fill="#1f1a17" />
            <path d="M100 122 93 115h14Z" fill="#c2512f" />
            <path
              d="M88 130q12 10 24 0"
              stroke="#1f1a17"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FileChip label="PNG 4096px" tone="bg-primary/10 text-primary" />
          <FileChip label="SVG" tone="bg-sage/15 text-sage" />
          <FileChip label="PDF" tone="bg-muted text-foreground" />
          <FileChip label="DXF" tone="bg-muted text-foreground" />
          <FileChip label="300 DPI" tone="bg-muted text-foreground" />
        </div>
      </div>

      <div className="paper-card relative -mt-3 ml-10 rotate-[2deg] p-4 sm:ml-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Etsy listing
        </p>
        <p className="mt-1 font-display text-[15px] font-semibold leading-snug">
          Cute Cat PNG, Kawaii Kitten Shirt Design, Sublimation Clipart
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {["cat png", "kawaii cat", "sublimation", "cat lover gift"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onStart }: { onStart: (type?: ProductTypeId) => void }) {
  return (
    <div className="w-full overflow-x-hidden bg-background text-foreground">
      {/* Hero */}
      <section className="relative border-b border-border">
        <div className="paper-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              From one idea to a complete Etsy listing
            </span>
            <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Design it once.
              <br />
              <span className="italic text-primary">Sell it tonight.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Describe a product and get native 4K artwork, transparent PNGs, Cricut-ready SVG cut
              files, realistic mockups and SEO listing copy in a single download.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => onStart()}
                className="h-12 rounded-full px-7 text-base glow-primary"
              >
                <Wand2 className="h-4 w-4" /> Create a product
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full bg-card px-7 text-base"
              >
                <a href="#product-types">
                  <Layers className="h-4 w-4" /> Browse {PRODUCT_TYPES.length} product types
                </a>
              </Button>
            </div>
            <ul className="mt-8 grid max-w-lg gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                "Use your own Gemini, OpenAI or OpenRouter key",
                "Cost estimate before every run",
                "Trademarks and famous characters blocked",
                "Commercial-use original artwork",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Deliverables */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            What's in the ZIP
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Every file a buyer expects, made for you.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <div
              key={d.title}
              className="paper-card group p-6 transition-transform hover:-translate-y-0.5"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <d.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{d.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product types */}
      <section id="product-types" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Product types
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The Etsy downloads that sell.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Each type has its own art direction, print size, file set and listing mockups.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onStart(t.id)}
              className="paper-card group flex flex-col p-5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-semibold">{t.label}</span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{t.blurb}</span>
              <span className="mt-3 flex flex-wrap gap-1">
                {t.formats.slice(0, 5).map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              Three steps, no design software.
            </h2>
            <p className="mt-4 text-muted-foreground">
              You stay in control of every file. Nothing is published to your shop until you upload
              it yourself.
            </p>
          </div>
          <ol className="grid gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="paper-card flex gap-5 p-6">
                <span className="font-display text-3xl font-semibold italic text-primary">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* More studios */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/" search={{ tab: "crochet" }} className="paper-card group p-6">
            <FileImage className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-display text-xl font-semibold">Crochet pattern studio</h3>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Generate written crochet patterns as printable PDFs with a styled cover photo.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/adobe-stock" className="paper-card group p-6">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-display text-xl font-semibold">Adobe Stock studio</h3>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Policy-checked images, vectors and videos with matching titles and keywords.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-foreground px-6 py-14 text-background sm:px-12">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/40 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Your next listing is one prompt away.
              </h2>
              <p className="mt-2 opacity-70">
                Add an AI key in Settings, describe your product, and download the ZIP.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => onStart()}
              className="h-12 shrink-0 rounded-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Start creating
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
