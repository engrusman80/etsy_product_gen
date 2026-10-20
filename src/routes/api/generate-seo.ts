import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm, hasProfanity } from "@/lib/ip-guard";
import { getProductType } from "@/lib/product-types";

const checkIP = findProtectedTerm;

type Shop = {
  shopName?: string;
  instagram?: string;
  pinterest?: string;
  facebook?: string;
  etsy?: string;
  website?: string;
  email?: string;
};

function stripProto(s: string) {
  return s
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

export function normalizeSocial(
  value: string | undefined,
  platform: "instagram" | "pinterest" | "facebook" | "etsy" | "website",
): { url: string; display: string } | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return { url: raw, display: stripProto(raw) };
  }
  const handle = raw.replace(/^@/, "").replace(/^\/+/, "");
  if (platform === "website" || /\.[a-z]{2,}/i.test(handle)) {
    const url = `https://${stripProto(handle)}`;
    return { url, display: stripProto(url) };
  }
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    pinterest: "https://pinterest.com/",
    facebook: "https://facebook.com/",
    etsy: "https://etsy.com/shop/",
  };
  const url = `${bases[platform]}${handle}`;
  return { url, display: stripProto(url) };
}

type SeoData = {
  productName: string;
  tagline: string;
  hook: string;
  receive: string[];
  howItWorks: string[];
  perfectFor: string[];
  whyLove: string[];
  notes: string[];
  keywords: string[];
};

function buildDescription(d: SeoData, shop: Shop, crochet = false): string {
  const year = new Date().getFullYear();
  const shopName = (shop.shopName || "Our Shop").trim();
  const L: string[] = [];

  L.push(`🌿 Digital Product: ${d.productName}`);
  L.push("");
  L.push(`✨ ${d.tagline}`);
  L.push("");
  L.push(d.hook.trim());
  L.push("");
  L.push("📦 What You Will Receive");
  L.push("");
  L.push("After purchase, you will get:");
  L.push("");
  for (const f of d.receive) L.push(` ✔ ${f}`);
  L.push("");
  L.push("🖨️ How It Works");
  L.push("");
  for (const s of d.howItWorks) L.push(` ${s}`);
  L.push("");
  if (!crochet) {
    L.push("💡 You can also use it digitally on iPad or tablet (GoodNotes / Notability supported)");
    L.push("");
  }
  L.push("🎯 Perfect For");
  L.push("");
  for (const p of d.perfectFor) L.push(` ${p}`);
  L.push("");
  L.push("💡 Why You'll Love It");
  L.push("");
  for (const w of d.whyLove) L.push(` ${w}`);
  L.push("");
  L.push("⚠️ Important Notes");
  L.push("");
  for (const n of d.notes) L.push(` ${n}`);
  // Etsy's creativity standards: say what the buyer gets and how it was made.
  if (crochet) {
    L.push(" 🧶 This listing is a PDF crochet PATTERN (digital download), not a finished item.");
    L.push(
      " 📷 Product photos are digital renders of the finished design; your result may vary with yarn and hook.",
    );
  }
  L.push(` 🤖 Designed by ${(shop.shopName || "our shop").trim()} with the help of AI tools.`);
  L.push("");
  L.push("🔍 SEO Keywords (for Etsy tags inspiration)");
  L.push("");
  L.push(d.keywords.join(", "));
  L.push("");

  const social: string[] = [];
  const ig = normalizeSocial(shop.instagram, "instagram");
  const pi = normalizeSocial(shop.pinterest, "pinterest");
  const fb = normalizeSocial(shop.facebook, "facebook");
  const et = normalizeSocial(shop.etsy, "etsy");
  const ws = normalizeSocial(shop.website, "website");
  if (ig) social.push(`🌇 INSTAGRAM: ${ig.display}`);
  if (pi) social.push(`📌 PINTEREST: ${pi.display}`);
  if (fb) social.push(`📘 FACEBOOK: ${fb.display}`);
  if (shop.email) social.push(`📧 EMAIL: ${shop.email.trim()}`);
  if (et) social.push(`🧡 ETSY: ${et.display}`);
  if (ws) social.push(`🌐 WEBSITE: ${ws.display}`);
  if (social.length) {
    L.push(...social);
    L.push("");
  }

  L.push(`©${year} ${shopName}, All Rights Reserved.`);
  L.push("By purchasing this item, you are automatically agreeing to the terms of use.");
  L.push("No sharing files, or selling them in any form. Derivative works are prohibited.");

  return L.join("\n");
}

/** Drops any title phrase that names a protected brand, then trims to Etsy's 140 chars. */
function titleOf(raw: string): string {
  const parts = raw.split(/\s*[,|]\s*/).filter((p) => p && !checkIP(p));
  return parts.join(", ").slice(0, 140);
}

export const Route = createFileRoute("/api/generate-seo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            idea: string;
            shop?: Shop;
            productType?: string;
            listingKind?: "crochet-pattern";
          };
          const { idea, shop = {} } = body;
          const crochet = body.listingKind === "crochet-pattern";
          const type = body.productType ? getProductType(body.productType) : null;
          const typeLine = crochet
            ? "Product type: Crochet pattern PDF\nThe buyer receives: an instant-download PDF crochet pattern (written rounds with stitch counts, abbreviations, materials, assembly and photos). Not a finished item, no yarn included.\n"
            : type
              ? `Product type: ${type.label}\nThe buyer receives: ${type.receives}.\n`
              : "";
          if (!idea || idea.trim().length < 3) {
            return Response.json({ error: "Please describe your product idea." }, { status: 400 });
          }
          const violated = checkIP(idea);
          if (violated) {
            return Response.json(
              {
                error: `Your idea references "${violated}", which is a protected brand/IP. Etsy prohibits unlicensed use. Please rewrite without trademarked names.`,
              },
              { status: 400 },
            );
          }

          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          const system = `You are an Etsy SEO expert writing for a digital download / print-on-demand listing. Follow Etsy 2025 guidelines strictly.

Return ONLY valid JSON of this exact shape:
{
  "title": string,            // 120-140 chars, front-load keywords, commas separating phrases, no ALL CAPS, no emoji, no trademarks
  "productName": string,      // short product name (e.g. "Printable Minimalist Weekly Planner")
  "tagline": string,          // 1 short benefit-driven sentence (max 80 chars)
  "hook": string,             // 2 paragraphs (~400-600 chars total). Describe what it is, who it's for, the benefit. Plain text. Separate paragraphs with \\n\\n.
  "receive": string[],        // 4-6 items describing what the buyer receives (file types, sizes, DPI, instant download note). No leading checkmark.
  "howItWorks": string[],     // EXACTLY 4 short steps, each prefixed with a relevant emoji (e.g. "🛒 Purchase this listing"). Keep each under 70 chars.
  "perfectFor": string[],     // 4-6 short audience bullets, each prefixed with an emoji.
  "whyLove": string[],        // 4-6 short benefit bullets, each prefixed with an emoji.
  "notes": string[],          // 3-5 important notes (digital only, color variation, personal use, no reselling), each prefixed with a relevant emoji.
  "keywords": string[],       // 8-12 SEO keyword phrases for inspiration, lowercase, comma-free.
  "tags": string[]            // EXACTLY 13 Etsy tags, each <=20 chars, lowercase, multi-word preferred, no commas inside a tag, no duplicates, no trademarks.
}
Do not include social links or copyright — the caller appends those. No HTML.

Etsy policy rules (listings that break these get removed):
- ${IP_RULES} This applies to the title, tags, keywords and text.
- Describe only what the buyer really receives. A digital download must never be called handmade, a finished item, or shipped.
- No claims you cannot prove: no "best seller", "#1", "guaranteed", medical or safety claims (for toys say "add safety eyes for children over 3, or embroider eyes for babies").
- If the idea has swear words, keep them out of the title and tags (write "funny sarcastic" or "adult humor" instead).
- Use the buyer's search words (item, style, occasion, recipient), not shop jargon. No keyword stuffing or repeated words in the title.`;

          let content: string;
          try {
            content = await callText({
              provider,
              key,
              system,
              user: `Product idea: ${idea}\n${typeLine}Write the title, tags and "receive" list for this product.`,
              json: true,
            });
          } catch (e) {
            const status = statusFromError(e);
            const msg = (e as Error).message;
            if (status === 429)
              return Response.json({ error: "Rate limit reached. Try again shortly." }, { status });
            if (status === 402)
              return Response.json({ error: "AI credits exhausted." }, { status });
            if (status === 401)
              return Response.json({ error: "Invalid API key. Check Settings." }, { status });
            return Response.json({ error: msg }, { status });
          }
          // Strip ```json fences if present (Gemini direct sometimes wraps despite mime type)
          const cleaned = content
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned || "{}");

          const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags : [];
          const cleanTags = tags
            .map((t: string) =>
              String(t).toLowerCase().trim().replace(/,/g, " ").replace(/\s+/g, " "),
            )
            .filter((t: string) => t.length > 0 && t.length <= 20 && !checkIP(t))
            .filter((t: string, i: number, a: string[]) => a.indexOf(t) === i)
            .slice(0, 13);

          const arr = (v: unknown): string[] =>
            Array.isArray(v) ? v.map((x) => String(x)).filter((x) => x.trim().length > 0) : [];

          const data: SeoData = {
            productName: String(parsed.productName ?? idea).trim(),
            tagline: String(parsed.tagline ?? "").trim(),
            hook: String(parsed.hook ?? ""),
            receive: arr(parsed.receive),
            howItWorks: arr(parsed.howItWorks),
            perfectFor: arr(parsed.perfectFor),
            whyLove: arr(parsed.whyLove),
            notes: arr(parsed.notes),
            keywords: arr(parsed.keywords).filter((k) => !checkIP(k)),
          };
          const description = buildDescription(data, shop, crochet);

          return Response.json({
            title: titleOf(String(parsed.title ?? "")),
            description,
            tags: cleanTags,
            // Etsy wants profanity marked as mature content in the listing.
            mature: hasProfanity(idea),
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
