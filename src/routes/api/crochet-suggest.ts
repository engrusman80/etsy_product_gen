import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm } from "@/lib/ip-guard";

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

export const Route = createFileRoute("/api/crochet-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          // Buyers shop about two months ahead of a season, so aim at the coming holidays.
          const now = new Date();
          const month = MONTHS[now.getMonth()];
          const next = MONTHS[(now.getMonth() + 2) % 12];
          const system = `You are a bestselling Etsy crochet-pattern designer. Suggest fresh, ORIGINAL, high-demand crochet pattern ideas that would sell well on Etsy right now (it is ${month} ${now.getFullYear()}; buyers are shopping for the season and holidays through ${next}).
Mix: about half seasonal or gift ideas, half evergreen best-seller categories (amigurumi plush and keychains, granny-square bags and tops, home decor, baby items, pet accessories, wearables like beanies and cardigans).
Prefer novel combinations (unusual subject + technique such as chenille, mosaic, tapestry, filet, C2C, puff or bobble + style) with a clear finished item a buyer can picture and gift.
${IP_RULES} Avoid clichés.
Return ONLY JSON: { "ideas": string[] } with exactly 10 items. Each idea is 5–12 words, specific enough to generate a full pattern from (subject + style/technique hint). No numbering, no emojis.`;

          const content = await callText({
            provider,
            key,
            system,
            json: true,
            user: `Give 10 unique crochet pattern ideas. Random seed: ${Math.random().toString(36).slice(2)}.`,
          });
          const cleaned = content
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned || "{}") as { ideas?: unknown };
          const ideas = Array.isArray(parsed.ideas)
            ? parsed.ideas
                .map(String)
                .filter((i) => i && !findProtectedTerm(i))
                .slice(0, 10)
            : [];
          if (ideas.length === 0)
            return Response.json({ error: "No ideas returned" }, { status: 500 });
          return Response.json({ ideas });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: statusFromError(e) });
        }
      },
    },
  },
});
