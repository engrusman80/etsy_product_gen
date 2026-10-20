import { findProtectedTerm, hasProfanity } from "@/lib/ip-guard";

/**
 * Daily shop check: finds listings that risk an Etsy takedown or sell worse, and prepares a fix
 * the seller applies with one click. Nothing is changed on Etsy without that click.
 */

export type ListingLike = {
  listing_id: number;
  title: string;
  description: string;
  tags: string[];
  url?: string;
  price?: { amount: number; divisor: number; currency_code: string };
};

export type Issue = { level: "high" | "medium" | "low"; text: string };
export type Fix = { title?: string; tags?: string[]; description?: string };
export type ListingReport = { listing: ListingLike; issues: Issue[]; fix: Fix | null };

const AI_LINE = /\bAI\b|artificial intelligence/i;
const PATTERN = /\bpattern\b/i;

/** Splits the title into its comma phrases and keeps the ones without a protected name. */
function cleanTitle(title: string) {
  const parts = title.split(/\s*[,|]\s*/).filter(Boolean);
  const kept = parts.filter((p) => !findProtectedTerm(p));
  return kept.join(", ").slice(0, 140);
}

export function checkListing(l: ListingLike, shopName: string): ListingReport {
  const issues: Issue[] = [];
  const fix: Fix = {};

  const titleTerm = findProtectedTerm(l.title);
  if (titleTerm) {
    issues.push({ level: "high", text: `Title names "${titleTerm}", a protected brand or name.` });
    const t = cleanTitle(l.title);
    if (t.length >= 20) fix.title = t;
  }
  const badTags = l.tags.filter((t) => findProtectedTerm(t));
  if (badTags.length) {
    issues.push({ level: "high", text: `Tags with protected names: ${badTags.join(", ")}.` });
  }
  const descTerm = findProtectedTerm(l.description);
  if (descTerm && descTerm !== titleTerm) {
    issues.push({
      level: "high",
      text: `Description mentions "${descTerm}". Edit that sentence on Etsy (it is not changed automatically).`,
    });
  }
  if (hasProfanity(l.title)) {
    issues.push({
      level: "medium",
      text: "Swear word in the title. Keep it out of the title and mark the listing as mature on Etsy.",
    });
  }

  // Tags: Etsy allows 13, each one is a free search entry.
  const tags = l.tags.filter((t) => !findProtectedTerm(t));
  if (tags.length < 13) {
    const have = new Set(tags.map((t) => t.toLowerCase()));
    const extra = (fix.title ?? l.title)
      .split(/\s*[,|]\s*/)
      .map((p) =>
        p
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .trim(),
      )
      .filter((p) => p.length >= 3 && p.length <= 20 && !have.has(p) && !findProtectedTerm(p));
    const filled = [...tags, ...new Set(extra)].slice(0, 13);
    issues.push({
      level: "low",
      text: `Uses ${l.tags.length} of 13 tags.${filled.length > tags.length ? " Adds phrases from the title." : ""}`,
    });
    if (filled.length !== l.tags.length || badTags.length) fix.tags = filled;
  } else if (badTags.length) fix.tags = tags;

  if (l.title.length < 40)
    issues.push({
      level: "low",
      text: "Short title. Add what it is, the style and who it is for.",
    });
  const capsWords = l.title
    .split(/\s+/)
    .filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (capsWords.length >= 3)
    issues.push({
      level: "low",
      text: "Many ALL CAPS words in the title. Etsy asks for normal case.",
    });

  // Etsy's creativity standards want AI help disclosed in the description.
  const lines: string[] = [];
  if (!AI_LINE.test(l.description)) {
    issues.push({ level: "medium", text: "No AI disclosure in the description." });
    lines.push(`🤖 Designed by ${shopName || "our shop"} with the help of AI tools.`);
  }
  if (
    PATTERN.test(l.title) &&
    /crochet|knit/i.test(l.title) &&
    !/not a finished/i.test(l.description)
  ) {
    issues.push({
      level: "medium",
      text: "Pattern listing doesn't say it is a PDF pattern, not a finished item.",
    });
    lines.push("🧶 This listing is a PDF PATTERN (digital download), not a finished item.");
  }
  if (lines.length) fix.description = `${l.description.trimEnd()}\n\n${lines.join("\n")}`;

  if (l.price) {
    const usd = l.price.amount / l.price.divisor;
    if (l.price.currency_code === "USD" && usd < 1.5)
      issues.push({
        level: "low",
        text: `Price $${usd.toFixed(2)}: after Etsy fees about $${Math.max(0, usd - 0.2 - usd * 0.095 - 0.25).toFixed(2)} is left. Change prices on Etsy.`,
      });
  }

  return { listing: l, issues, fix: Object.keys(fix).length ? fix : null };
}

export function checkShop(listings: ListingLike[], shopName: string): ListingReport[] {
  const order = { high: 0, medium: 1, low: 2 };
  return listings
    .map((l) => checkListing(l, shopName))
    .filter((r) => r.issues.length)
    .sort(
      (a, b) =>
        Math.min(...a.issues.map((i) => order[i.level])) -
        Math.min(...b.issues.map((i) => order[i.level])),
    );
}
