import { aiHeaders, loadSettings } from "@/lib/settings-store";
import { etsyCall } from "@/lib/etsy/client";

/** Pricing, demand and sale-timing helpers for the Etsy page and the daily drafts. */

export async function aiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aiHeaders(loadSettings()) },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j;
}

export type Market = {
  keywords: string;
  count: number;
  prices: number[];
  currency: string;
  avgFavorites: number;
  topTitles: string[];
  error?: string;
};

export async function marketFor(keywords: string[]): Promise<Market[]> {
  const r = await etsyCall<{ markets: Market[] }>({ action: "market", keywords });
  return r.markets;
}

/** The search phrase a listing competes on: the first part of its title. */
export function priceKeyword(title: string) {
  return title
    .split(/\s*[,|–-]\s*/)[0]
    .replace(/\b(svg|png|pdf|dxf|eps|jpg|cut file|digital download|instant download)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

export type PriceAdvice = {
  median: number;
  low: number;
  high: number;
  suggested: number;
  sample: number;
};

/**
 * A little under the middle of the market, never under the seller's floor. The very cheapest
 * listings are ignored: being the lowest price makes buyers doubt the quality and leaves
 * nothing after Etsy fees.
 */
export function suggestPrice(m: Market, floor: number): PriceAdvice | null {
  if (m.prices.length < 5) return null;
  const median = quantile(m.prices, 0.5);
  const target = Math.max(floor, median * 0.9);
  // Round down to a .49 or .99 ending, which is what most Etsy prices use.
  const whole = Math.floor(target);
  const endings = [whole - 0.01, whole + 0.49, whole + 0.99].filter((p) => p <= target + 1e-9);
  const suggested = endings.length ? Math.max(...endings) : target;
  return {
    median,
    low: quantile(m.prices, 0.25),
    high: quantile(m.prices, 0.75),
    suggested: Math.round(Math.max(floor, suggested) * 100) / 100,
    sample: m.prices.length,
  };
}

export type DemandIdea = {
  idea: string;
  keyword: string;
  kind: string;
  competition: number;
  favorites: number;
  score: number;
};

/**
 * Asks the AI for trend ideas, then measures each on Etsy: fewer competing listings and more
 * favorites on the top results rank higher. Etsy shares no search volume, so this is an estimate.
 */
export async function findDemandIdeas(kind: string, count = 10): Promise<DemandIdea[]> {
  const { ideas } = await aiPost<{ ideas: { idea: string; keyword: string }[] }>(
    "/api/product-ideas",
    { kind, count },
  );
  const markets = await marketFor(
    ideas.map((i) => (kind === "crochet" ? `${i.keyword} pattern` : i.keyword)),
  );
  return ideas
    .map((i, n) => {
      const m = markets[n];
      const competition = m && !m.error ? m.count : -1;
      const favorites = m && !m.error ? m.avgFavorites : 0;
      const score = competition < 0 ? 0 : (favorites + 1) / Math.log10(competition + 10);
      return { ...i, kind, competition, favorites, score: Math.round(score * 10) / 10 };
    })
    .filter((i) => i.competition >= 0)
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ sales calendar */

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const d = new Date(year, month, 1);
  const shift = (weekday - d.getDay() + 7) % 7;
  return new Date(year, month, 1 + shift + (n - 1) * 7);
}

export type SaleTip = { event: string; date: Date; start: Date; end: Date; percent: number };

/** Shopping events in the next 60 days and when to run a sale for each. */
export function upcomingSales(now = new Date()): SaleTip[] {
  const out: SaleTip[] = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const blackFriday = new Date(nthWeekday(y, 10, 4, 4).getTime() + 86400000);
    const events: [string, Date, number, number][] = [
      // name, day, days before to start, percent
      ["Valentine's Day", new Date(y, 1, 14), 21, 20],
      ["St Patrick's Day", new Date(y, 2, 17), 14, 15],
      ["Mother's Day (US)", nthWeekday(y, 4, 0, 2), 21, 20],
      ["Back to school", new Date(y, 7, 15), 21, 15],
      ["Halloween", new Date(y, 9, 31), 21, 20],
      ["Black Friday to Cyber Monday", blackFriday, 0, 30],
      ["Christmas", new Date(y, 11, 25), 24, 25],
    ];
    for (const [event, date, lead, percent] of events) {
      const start = new Date(date.getTime() - lead * 86400000);
      const end = event.startsWith("Black Friday")
        ? new Date(date.getTime() + 3 * 86400000)
        : new Date(date.getTime() - 86400000);
      if (end >= now && start.getTime() - now.getTime() < 60 * 86400000)
        out.push({ event, date, start, end, percent });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
