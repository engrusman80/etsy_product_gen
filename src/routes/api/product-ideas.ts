import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm } from "@/lib/ip-guard";
import { getProductType } from "@/lib/product-types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Trend-led product ideas, each with the short phrase a buyer would search on Etsy, so the
 * Etsy page can measure competition and demand for it.
 */
export const Route = createFileRoute("/api/product-ideas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { kind = "crochet", count = 10 } = (await request.json()) as {
            kind?: string;
            count?: number;
          };
          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );
          const what =
            kind === "crochet"
              ? "crochet pattern PDFs (amigurumi, granny-square bags and tops, home decor, baby, pets, wearables; techniques like chenille, mosaic, tapestry, filet, C2C, bobble)"
              : `${getProductType(kind).label} digital downloads (${getProductType(kind).blurb})`;
          const now = new Date();
          const system = `You are an Etsy trend researcher. It is ${MONTHS[now.getMonth()]} ${now.getFullYear()}; buyers shop about 6-8 weeks ahead of holidays. Suggest ${Math.min(15, count)} specific, original ideas for ${what} that buyers are searching for now but that are not yet saturated: a clear niche, a season or holiday coming up, or a fresh twist on a best seller.
${IP_RULES}
Return ONLY JSON: { "ideas": [ { "idea": string, "keyword": string } ] }
"idea": 5-12 words, specific enough to generate the product from.
"keyword": the 2-4 word phrase a buyer would type into Etsy search for it, lowercase.`;
          const raw = await callText({
            provider,
            key,
            system,
            json: true,
            user: `Ideas please. Random seed: ${Math.random().toString(36).slice(2)}.`,
          });
          const j = JSON.parse(
            raw
              .trim()
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/```$/i, "")
              .trim() || "{}",
          ) as { ideas?: { idea?: string; keyword?: string }[] };
          const ideas = (j.ideas ?? [])
            .map((i) => ({
              idea: String(i.idea ?? "").trim(),
              keyword: String(i.keyword ?? "").trim(),
            }))
            .filter((i) => i.idea && i.keyword && !findProtectedTerm(`${i.idea} ${i.keyword}`));
          if (!ideas.length) return Response.json({ error: "No ideas returned" }, { status: 502 });
          return Response.json({ ideas });
        } catch (e) {
          return Response.json(
            { error: (e as Error).message },
            { status: statusFromError(e) || 500 },
          );
        }
      },
    },
  },
});
