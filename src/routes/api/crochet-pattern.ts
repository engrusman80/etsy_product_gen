import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";

const BLOCKED = [
  "disney",
  "marvel",
  "pokemon",
  "pokémon",
  "nintendo",
  "star wars",
  "harry potter",
  "hello kitty",
  "sanrio",
  "minion",
  "shrek",
  "frozen",
  "elsa",
  "mickey mouse",
  "spider-man",
  "spiderman",
  "batman",
  "superman",
  "pikachu",
  "mario",
];

function checkIP(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of BLOCKED) if (lower.includes(term)) return term;
  return null;
}

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
- Do NOT reference any brand, celebrity, or copyrighted character.
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

          return Response.json({ pattern: { ...parsed, seed } });
        } catch (e) {
          const status = statusFromError(e);
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
