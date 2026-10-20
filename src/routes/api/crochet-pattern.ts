import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm } from "@/lib/ip-guard";
import { checkStitchCounts } from "@/lib/crochet/validate";
import type { CrochetSection } from "@/lib/crochet/types";

const checkIP = findProtectedTerm;

export const Route = createFileRoute("/api/crochet-pattern")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            idea: string;
            seed?: string;
            terminology?: "US" | "UK";
            avoidTitles?: string[];
          };
          const { idea, seed, terminology = "US", avoidTitles = [] } = body;
          if (!idea || idea.trim().length < 3) {
            return Response.json({ error: "Idea is required" }, { status: 400 });
          }
          const violated = checkIP(idea);
          if (violated) {
            return Response.json(
              {
                error: `Idea references "${violated}" (trademarked/IP). Rewrite without brands or copyrighted characters.`,
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

          const avoidClause = avoidTitles.length
            ? `\n\nAvoid these already-generated titles (produce a distinctly DIFFERENT title and construction approach):\n${avoidTitles
                .slice(0, 20)
                .map((t, i) => `${i + 1}. ${t}`)
                .join("\n")}`
            : "";

          const system = `You are a professional crochet pattern designer publishing on Etsy. Write ORIGINAL, PROFESSIONAL, TECHNICALLY-CORRECT patterns using ${terminology} crochet terminology.

Return ONLY valid JSON matching this exact TypeScript shape (no markdown, no commentary):
{
  "title": string,                  // 60-100 chars — SEO-friendly Etsy title, no ALL CAPS, no emoji, no trademarks
  "subtitle": string,               // 1 short benefit line (≤ 90 chars)
  "skillLevel": "Beginner" | "Advanced Beginner" | "Intermediate" | "Advanced",
  "finishedSize": string,           // e.g. "≈ 15 cm tall using suggested yarn"
  "gauge": string,                  // e.g. "16 sc × 18 rows = 10 cm × 10 cm"
  "terminology": "${terminology}",
  "materials": {
    "hooks": string[],              // 1-3 items
    "yarn": string[],               // 3-8 items with color names + weight/quantity
    "notions": string[]             // 3-8 items (needle, stuffing, safety eyes, markers, etc.)
  },
  "abbreviations": [                // 6-14 items relevant to THIS pattern
    { "key": "sc", "meaning": "single crochet" }
  ],
  "specialStitches": [              // 0-4 items — describe any non-standard stitches used
    { "name": "invisible decrease", "how": "insert hook in front loop of next 2 sts, yo, pull through both, yo, pull through remaining 2 loops" }
  ],
  "sections": [                     // 3-8 ordered pattern sections
    {
      "name": "Head",
      "rows": [                     // 6-40 concise rows/rounds per section, each ≤ 90 chars, end with stitch count in parentheses
        "R1: 6 sc in magic ring (6)",
        "R2: inc × 6 (12)"
      ],
      "notes": []                   // optional short tips
    }
  ],
  "assembly": string[],             // 3-8 finishing/joining steps
  "care": string[],                 // 3-5 wash / block / storage tips
  "copyright": string,              // 1 line — for personal use only, no reselling the pattern itself
  "chartRounds": [                  // optional — 4-12 rounds represented as symbol arrays (use abbreviation strings)
    { "label": "R1", "symbols": ["sc","sc","sc","sc","sc","sc"] },
    { "label": "R2", "symbols": ["inc","inc","inc","inc","inc","inc"] }
  ]
}

Quality rules:
- Every row MUST end with the stitch count in parentheses, e.g. "(24)".
- Increases and decreases must add up correctly across rounds.
- Do NOT plagiarize existing published patterns. Invent an original construction and shaping approach.
- Before answering, recount every round: stitches worked must equal the previous round's count, and the count in parentheses must equal the stitches made. Write repeats as "(sc 2, inc) × 6" and plain rounds as "sc around".
- ${IP_RULES}
- Etsy policy: this is a digital PATTERN designed by the seller. Never call it a finished or handmade item, and make no safety or medical claims. For toys, note safety eyes are for ages 3+ and embroidered eyes for babies.
- Sellable on Etsy: a clear, giftable or useful finished piece with a strong silhouette that photographs well, made from commonly available yarn, with sizes or color variations where it makes sense.
- Make the pattern COMPLETE — a buyer should be able to finish the project using only this JSON.${avoidClause}`;

          const user = `Design a complete original crochet pattern for: "${idea}".
Uniqueness seed: ${seed ?? Math.random().toString(36).slice(2)}.
Make it distinctly different from typical stock crochet patterns for this subject — pick an unusual construction (top-down vs bottom-up, seamless vs paneled, unusual color-block, unusual stitch combo). ${terminology} terminology.`;

          const content = await callText({
            provider,
            key,
            system,
            user,
            json: true,
            tier: "pro", // higher quality — patterns must be technically correct
            maxTokens: 16000, // patterns are long
          });
          const cleaned = content
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```$/i, "")
            .trim();
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(cleaned) as Record<string, unknown>;
          } catch {
            return Response.json(
              { error: "AI returned invalid pattern JSON. Retry." },
              { status: 502 },
            );
          }

          // Rows that don't add up are the top reason for bad pattern reviews, so ask the model
          // to fix the reported rounds once and keep whichever version has fewer problems.
          let warnings = checkStitchCounts(parsed as { sections: CrochetSection[] });
          if (warnings.length && Array.isArray(parsed.sections)) {
            try {
              const fixed = await callText({
                provider,
                key,
                system:
                  'You correct crochet pattern stitch counts. Return ONLY JSON { "sections": [...] } with the same sections, names and shape, fixing every listed problem so each round works exactly the previous round\'s stitches and ends with the correct "(N)" count. Keep the design and size the same.',
                user: `Problems:\n${warnings.slice(0, 30).join("\n")}\n\nSections:\n${JSON.stringify(parsed.sections)}`,
                json: true,
                tier: "pro",
                maxTokens: 12000,
              });
              const sections = (
                JSON.parse(
                  fixed
                    .trim()
                    .replace(/^```(?:json)?\s*/i, "")
                    .replace(/```$/i, "")
                    .trim(),
                ) as { sections?: CrochetSection[] }
              ).sections;
              if (Array.isArray(sections) && sections.length) {
                const after = checkStitchCounts({ sections });
                if (after.length < warnings.length) {
                  parsed.sections = sections;
                  warnings = after;
                }
              }
            } catch {
              /* keep the first version and show its warnings */
            }
          }
          const title = String(parsed.title ?? "");
          if (checkIP(title)) parsed.title = idea.slice(0, 100);

          return Response.json({ pattern: { ...parsed, seed }, warnings });
        } catch (e) {
          const status = statusFromError(e);
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
