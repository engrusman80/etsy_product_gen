import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";

// Generates Adobe Stock-optimized SEO metadata for a generated asset.
// Strategy: prioritise HIGH-DEMAND, COMMERCIAL keywords that buyers actually search for
// (lifestyle, business, technology, AI, wellness, sustainability, finance, etc.).
//
// POST { prompt, assetType: "jpeg"|"png"|"svg"|"video" }
// →    { title, filename, description, keywords: string[], category }

type Body = { prompt: string; assetType: "jpeg" | "png" | "svg" | "video" };

const ADOBE_CATEGORIES = [
  "Animals",
  "Buildings and Architecture",
  "Business",
  "Drinks",
  "The Environment",
  "States of Mind",
  "Food",
  "Graphic Resources",
  "Hobbies and Leisure",
  "Industry",
  "Landscapes",
  "Lifestyle",
  "People",
  "Plants and Flowers",
  "Culture and Religion",
  "Science",
  "Social Issues",
  "Sports",
  "Technology",
  "Transport",
  "Travel",
];

export const Route = createFileRoute("/api/adobe-stock-meta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, assetType } = (await request.json()) as Body;
          if (!prompt || !assetType) {
            return Response.json({ error: "Missing prompt or assetType" }, { status: 400 });
          }

          const { provider, key } = resolveProvider(request);
          if (!key) {
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );
          }

          const isVideo = assetType === "video";
          const isVector = assetType === "svg";

          const system = `You are an Adobe Stock SEO expert who specialises in maximising sales of stock ${assetType === "video" ? "footage" : "imagery"}. You know exactly which keywords buyers search for and which generate the most downloads (and therefore revenue).

You MUST output ONLY a single valid JSON object — no markdown, no commentary — with these exact keys:
{
  "title": string,
  "filename": string,
  "description": string,
  "keywords": string[],
  "category": string
}

Adobe Stock metadata rules (STRICT):
- "title": 30-200 characters. Natural-sounding human-readable sentence/phrase that describes WHAT is in the asset and its STYLE/MOOD. Front-load the most important subject and key commercial keywords, but keep it readable — do NOT stuff. No quotes, no trailing period, no ALL-CAPS.
- "filename": lowercase, hyphenated, 4-8 words, no extension. Reflects main subject. Example: "young-woman-working-laptop-coffee-shop".
- "description": one or two sentences, 80-200 characters, describing the asset suitable for buyers browsing.
- "keywords": EXACTLY 40-49 keywords (Adobe allows 5-49, we target near-max for maximum discoverability). Each keyword is 1-3 words, lowercase, no punctuation. ORDER MATTERS — Adobe weights the first 10 keywords most heavily, so put the SINGLE most commercially valuable terms first. Mix:
    1) Main subject (literal what's in the asset)
    2) High-demand commercial themes that match: ${isVideo ? "business, technology, lifestyle, ai, finance, healthcare, remote work, sustainability, social media, e-commerce" : "business, lifestyle, technology, ai, wellness, sustainability, finance, healthcare, education, social media"}
    3) Mood / emotion (happy, modern, minimalist, cinematic, professional)
    4) Style / technique (${isVector ? "flat vector, line art, illustration, icon, infographic" : isVideo ? "cinematic, slow motion, aerial, b-roll, 4k" : "photorealistic, studio shot, flat lay, bokeh, golden hour"})
    5) Use-case (banner, hero, advertisement, social media post, presentation)
    6) Demographics / setting only if obviously present
  AVOID: trademarks, brand names, celebrity names, copyrighted characters, plural+singular duplicates, generic filler words ("background", "image", "video" alone).
- "category": MUST be one of EXACTLY these strings: ${ADOBE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.

Pick keywords that target HIGH-DEMAND, HIGH-REVENUE buyer searches — favour evergreen commercial themes over niche or trendy terms.`;

          const user = `Generate Adobe Stock SEO metadata for this ${assetType.toUpperCase()} asset.

Original prompt used to generate the asset:
"""
${prompt}
"""

Remember: maximise commercial demand. Output ONLY the JSON object.`;

          const raw = await callText({
            provider,
            key,
            system,
            user,
            json: true,
            tier: "fast",
            maxTokens: 8192,
          });

          // Strip any accidental fences and parse
          const cleaned = raw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          let parsed: {
            title?: string;
            filename?: string;
            description?: string;
            keywords?: unknown;
            category?: string;
          };
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            // Try to extract first {...} block
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (!m) return Response.json({ error: "Model returned invalid JSON" }, { status: 502 });
            parsed = JSON.parse(m[0]);
          }

          // Normalise + safety-clamp
          const title = String(parsed.title || "")
            .slice(0, 200)
            .trim();
          const description = String(parsed.description || "")
            .slice(0, 250)
            .trim();
          const filename =
            String(parsed.filename || "")
              .toLowerCase()
              .replace(/\.[a-z0-9]{2,4}$/i, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 80) || "adobe-stock-asset";

          let keywords: string[] = [];
          if (Array.isArray(parsed.keywords)) {
            keywords = parsed.keywords
              .map((k) =>
                String(k)
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9 -]/g, "")
                  .replace(/\s+/g, " "),
              )
              .filter((k) => k.length >= 2 && k.length <= 40);
            // de-dupe preserving order
            const seen = new Set<string>();
            keywords = keywords.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
            keywords = keywords.slice(0, 49);
          }

          const category = ADOBE_CATEGORIES.includes(parsed.category || "")
            ? parsed.category!
            : "Graphic Resources";

          if (!title || keywords.length < 5) {
            return Response.json({ error: "Model returned incomplete metadata" }, { status: 502 });
          }

          return Response.json({ title, filename, description, keywords, category });
        } catch (e) {
          console.error("[adobe-stock-meta] failed:", e);
          const status = statusFromError(e);
          const message = e instanceof Error ? e.message : String(e);
          return Response.json({ error: message || "Metadata generation failed" }, { status });
        }
      },
    },
  },
});
