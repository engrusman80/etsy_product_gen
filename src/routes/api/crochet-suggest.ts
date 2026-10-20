import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";

export const Route = createFileRoute("/api/crochet-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { provider, key } = resolveProvider(request);
          if (!key) return Response.json({ error: `Missing API key for ${provider}. Add it in Settings.` }, { status: 401 });

          const system = `You are a bestselling Etsy crochet-pattern designer. Suggest fresh, ORIGINAL, high-demand crochet pattern ideas that would sell well on Etsy in 2026. Avoid clichés, avoid trademarks, avoid copyrighted characters. Prefer novel combinations (unusual subject + technique + season/style).
Return ONLY JSON: { "ideas": string[] } with exactly 10 items. Each idea is 5–12 words, specific enough to generate a full pattern from (subject + style/technique hint). No numbering, no emojis.`;

          const content = await callText({
            provider, key, system, json: true,
            user: `Give 10 unique crochet pattern ideas. Random seed: ${Math.random().toString(36).slice(2)}.`,
          });
          const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
          const parsed = JSON.parse(cleaned || "{}") as { ideas?: unknown };
          const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.map(String).filter(Boolean).slice(0, 10) : [];
          if (ideas.length === 0) return Response.json({ error: "No ideas returned" }, { status: 500 });
          return Response.json({ ideas });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: statusFromError(e) });
        }
      },
    },
  },
});
