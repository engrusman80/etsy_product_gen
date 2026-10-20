// Per-provider cost estimator for generation runs.
// Numbers are PUBLIC list-price approximations as of mid-2026 and may drift —
// surface them as "estimates", not invoices.

export type Provider = "lovable" | "openai" | "gemini" | "openrouter";

export type OpKind = "text" | "image" | "mockup" | "removebg";

/** Per-op cost in USD. Default gateway also tracks credits separately. */
type ProviderCost = {
  label: string;
  /** Cost per single call, in USD. */
  usd: Record<OpKind, number>;
  /** Credits per call (only meaningful for the default gateway). */
  credits?: Record<OpKind, number>;
  /** Free quota hint shown in UI. */
  freeNote?: string;
  /** Where the user manages billing/quota. */
  billingUrl?: string;
  /** Underlying model names per op (for transparency in the breakdown). */
  models: Partial<Record<OpKind, string>>;
};

// Default AI gateway: ~1 credit ≈ $0.01 to the workspace. Costs are
// derived from the underlying model published pricing.
const LOVABLE: ProviderCost = {
  label: "Default AI",
  usd: { text: 0.0002, image: 0.24, mockup: 0.039, removebg: 0 },
  credits: { text: 0.02, image: 24, mockup: 3.9, removebg: 0 },
  freeNote: "Uses your workspace credits ($25 free Cloud + $1 free AI / month).",
  models: {
    text: "google/gemini-2.5-flash",
    image: "google/gemini-3-pro-image-preview (4K)",
    mockup: "google/gemini-2.5-flash-image",
  },
};

const OPENAI: ProviderCost = {
  label: "OpenAI",
  usd: { text: 0.0005, image: 0.19, mockup: 0.19, removebg: 0 },
  freeNote: "Pay-per-use — no free quota. gpt-image-1 high quality is the priciest line item.",
  billingUrl: "https://platform.openai.com/account/billing",
  models: {
    text: "gpt-4o-mini",
    image: "gpt-image-1 (high, 1024²)",
    mockup: "gpt-image-1 (edits, high, 1024²)",
  },
};

const GEMINI: ProviderCost = {
  label: "Google Gemini",
  usd: { text: 0.0001, image: 0.24, mockup: 0.039, removebg: 0 },
  freeNote:
    "AI Studio keys are free for text (SEO, patterns). Image models need billing enabled on the key.",
  billingUrl: "https://aistudio.google.com/apikey",
  models: {
    text: "newest Gemini Flash on your key",
    image: "newest Gemini Pro Image (4K)",
    mockup: "newest Gemini Flash Image",
  },
};

const OPENROUTER: ProviderCost = {
  label: "OpenRouter",
  usd: { text: 0.0002, image: 0.25, mockup: 0.04, removebg: 0 },
  freeNote: "Pay-per-use, ~5% markup over upstream provider.",
  billingUrl: "https://openrouter.ai/credits",
  models: {
    text: "google/gemini-2.5-flash",
    image: "google/gemini-3-pro-image-preview (4K)",
    mockup: "google/gemini-2.5-flash-image",
  },
};

// remove.bg is an independent paid service (not an AI provider).
const REMOVEBG_USD_PER_IMAGE = 0.2;

// Claude Opus 5.5 ($4 / $20 per million tokens): ~2K tokens in, ~3K out with its thinking.
const CLAUDE_SEO_USD = 0.07;
const CLAUDE_MODEL = "Claude Opus 5.5";

// Best-quality mockups use the Pro image model at 2K (Etsy asks for 2000px photos).
const MOCKUP_2K: Partial<Record<Provider, number>> = { gemini: 0.134, openrouter: 0.14 };

export const PROVIDERS: Record<Provider, ProviderCost> = {
  lovable: LOVABLE,
  openai: OPENAI,
  gemini: GEMINI,
  openrouter: OPENROUTER,
};

export type EstimateInput = {
  provider: Provider;
  /** Number of distinct products / keywords. */
  products: number;
  /** Variations per product. */
  variations: number;
  /** Mockups generated per variation. */
  mockupsPerVariation: number;
  /** Whether remove.bg API will be called (vs local skip). */
  useRemoveBgApi: boolean;
  /** Cheaper ~1K flash image instead of native 4K pro image. */
  fastImage?: boolean;
  /** The user uploaded their own artwork, so no design is generated. */
  uploaded?: boolean;
  /** Claude writes the SEO text instead of the image provider. */
  claudeText?: boolean;
};

export type LineItem = {
  label: string;
  count: number;
  perCallUsd: number;
  perCallCredits?: number;
  model?: string;
  totalUsd: number;
  totalCredits?: number;
};

export type Estimate = {
  provider: Provider;
  providerLabel: string;
  freeNote?: string;
  billingUrl?: string;
  items: LineItem[];
  totalUsd: number;
  totalCredits?: number;
  totalCalls: number;
};

export function estimateRun(input: EstimateInput): Estimate {
  const { provider, products, variations, mockupsPerVariation, useRemoveBgApi } = input;
  const p = PROVIDERS[provider];

  const seoCalls = products; // 1 SEO per product (shared across variations)
  const variationCount = products * variations;
  const imageCalls = input.uploaded ? 0 : variationCount; // 1 design per variation
  const mockupCalls = variationCount * mockupsPerVariation;
  const bgCalls = useRemoveBgApi ? variationCount : 0;

  const items: LineItem[] = [];

  const addLine = (
    label: string,
    count: number,
    op: OpKind,
    modelOverride?: string,
    perCallUsdOverride?: number,
  ) => {
    if (count <= 0) return;
    const perCallUsd = perCallUsdOverride ?? p.usd[op];
    const perCallCredits = p.credits?.[op];
    items.push({
      label,
      count,
      perCallUsd,
      perCallCredits,
      model: modelOverride ?? p.models[op],
      totalUsd: perCallUsd * count,
      totalCredits: perCallCredits != null ? perCallCredits * count : undefined,
    });
  };

  addLine(
    "SEO listing (title, description, tags)",
    seoCalls,
    "text",
    input.claudeText ? CLAUDE_MODEL : undefined,
    input.claudeText ? CLAUDE_SEO_USD : undefined,
  );
  // OpenAI has one image tier; the fast mode only changes the Gemini-based providers.
  const fast = input.fastImage && provider !== "openai";
  addLine(
    fast ? "Product artwork (fast, ~1K)" : "Product artwork",
    imageCalls,
    "image",
    fast ? p.models.mockup : undefined,
    fast ? p.usd.mockup : undefined,
  );
  const mockup2k = fast ? undefined : MOCKUP_2K[provider];
  addLine(
    mockup2k ? "Mockup photo (2K)" : "Mockup composition",
    mockupCalls,
    "mockup",
    mockup2k ? "newest Gemini Pro Image (2K)" : undefined,
    mockup2k,
  );
  if (bgCalls > 0) {
    items.push({
      label: "Background removal (remove.bg API)",
      count: bgCalls,
      perCallUsd: REMOVEBG_USD_PER_IMAGE,
      model: "remove.bg",
      totalUsd: REMOVEBG_USD_PER_IMAGE * bgCalls,
    });
  }

  const totalUsd = items.reduce((a, i) => a + i.totalUsd, 0);
  const totalCredits = p.credits ? items.reduce((a, i) => a + (i.totalCredits ?? 0), 0) : undefined;
  const totalCalls = items.reduce((a, i) => a + i.count, 0);

  return {
    provider,
    providerLabel: input.claudeText ? `Claude for text and ${p.label} for images` : p.label,
    freeNote: p.freeNote,
    billingUrl: p.billingUrl,
    items,
    totalUsd,
    totalCredits,
    totalCalls,
  };
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `< $0.01`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function formatCredits(n: number): string {
  if (n < 1) return `${n.toFixed(2)} cr`;
  return `${n.toFixed(1)} cr`;
}
