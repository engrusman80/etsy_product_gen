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
  usd:     { text: 0.0002, image: 0.039, mockup: 0.039, removebg: 0 },
  credits: { text: 0.02,   image: 3.9,   mockup: 3.9,   removebg: 0 },
  freeNote: "Uses your workspace credits ($25 free Cloud + $1 free AI / month).",
  models: { text: "google/gemini-2.5-flash", image: "google/gemini-2.5-flash-image", mockup: "google/gemini-2.5-flash-image" },
};

const OPENAI: ProviderCost = {
  label: "OpenAI",
  usd: { text: 0.0005, image: 0.19, mockup: 0.19, removebg: 0 },
  freeNote: "Pay-per-use — no free quota. gpt-image-1 high quality is the priciest line item.",
  billingUrl: "https://platform.openai.com/account/billing",
  models: { text: "gpt-4o-mini", image: "gpt-image-1 (high, 1024²)", mockup: "gpt-image-1 (edits, 1024²)" },
};

const GEMINI: ProviderCost = {
  label: "Google Gemini",
  usd: { text: 0.0001, image: 0.039, mockup: 0.039, removebg: 0 },
  freeNote: "Free tier: 1,500 text + ~100 image requests/day on AI Studio keys. Estimates assume paid tier.",
  billingUrl: "https://aistudio.google.com/apikey",
  models: { text: "gemini-2.5-flash", image: "gemini-2.5-flash-image-preview", mockup: "gemini-2.5-flash-image-preview" },
};

const OPENROUTER: ProviderCost = {
  label: "OpenRouter",
  usd: { text: 0.0002, image: 0.04, mockup: 0.04, removebg: 0 },
  freeNote: "Pay-per-use, ~5% markup over upstream provider.",
  billingUrl: "https://openrouter.ai/credits",
  models: { text: "google/gemini-2.5-flash", image: "google/gemini-2.5-flash-image-preview", mockup: "google/gemini-2.5-flash-image-preview" },
};

// remove.bg is an independent paid service (not an AI provider).
const REMOVEBG_USD_PER_IMAGE = 0.20;

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

  const seoCalls = products;                                 // 1 SEO per product (shared across variations)
  const imageCalls = products * variations;                  // 1 design per variation
  const mockupCalls = products * variations * mockupsPerVariation;
  const bgCalls = useRemoveBgApi ? imageCalls : 0;

  const items: LineItem[] = [];

  const addLine = (label: string, count: number, op: OpKind, modelOverride?: string, perCallUsdOverride?: number) => {
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

  addLine("SEO listing (title, description, tags)", seoCalls, "text");
  addLine("Product artwork", imageCalls, "image");
  addLine("Mockup composition", mockupCalls, "mockup");
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
  const totalCredits = p.credits
    ? items.reduce((a, i) => a + (i.totalCredits ?? 0), 0)
    : undefined;
  const totalCalls = items.reduce((a, i) => a + i.count, 0);

  return {
    provider,
    providerLabel: p.label,
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
