import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm } from "@/lib/ip-guard";

/** Rewrites an existing Etsy listing's title, tags and description for search, keeping its facts. */
export const Route = createFileRoute("/api/improve-listing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            title: string;
            description: string;
            tags: string[];
            competitorTitles?: string[];
          };
          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          const system = `You are an Etsy SEO expert improving an existing digital-download listing. Return ONLY JSON:
{ "title": string, "tags": string[], "description": string }

Title: 100-140 chars, the main search phrase first, then 3-5 more buyer phrases separated by commas (item, style, use, occasion, recipient). Normal case, no emoji, no repeated words, no keyword stuffing.
Tags: EXACTLY 13, lowercase, each 20 characters or fewer, multi-word buyer phrases, none repeating the same words as another tag, no commas.
Description: keep every fact from the original (what the files are, formats, sizes, sizes in pixels or inches, licence and terms, shop links, notes). Do not invent formats, sizes, bonuses or claims. Open with 2 short sentences that repeat the main search phrase naturally and say who it is for. Keep the original sections and emoji style; tidy wording only. Plain text, no HTML.
Etsy policy: ${IP_RULES} Remove any such names from the title, tags and description. Never call a digital file handmade, a finished item or shipped. No "best seller", "#1" or guaranteed claims. Keep any line that discloses AI help.`;

          const user = `Current title: ${body.title}
Current tags: ${body.tags.join(", ")}
Current description:
${body.description}
${body.competitorTitles?.length ? `\nTitles of top-ranking similar listings (for search words only, do not copy):\n${body.competitorTitles.slice(0, 10).join("\n")}` : ""}`;

          const raw = await callText({ provider, key, system, user, json: true, maxTokens: 4000 });
          const j = JSON.parse(
            raw
              .trim()
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/```$/i, "")
              .trim() || "{}",
          ) as { title?: string; tags?: unknown; description?: string };

          const title = String(j.title ?? "")
            .split(/\s*,\s*/)
            .filter((p) => p && !findProtectedTerm(p))
            .join(", ")
            .slice(0, 140);
          const seen = new Set<string>();
          const tags = (Array.isArray(j.tags) ? j.tags : [])
            .map((t) => String(t).toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim())
            .filter(
              (t) => t && t.length <= 20 && !findProtectedTerm(t) && !seen.has(t) && seen.add(t),
            )
            .slice(0, 13);
          // Drop any line that still names a protected brand rather than risk a takedown.
          const description = String(j.description ?? "")
            .split("\n")
            .filter((l) => !findProtectedTerm(l))
            .join("\n")
            .trim();
          if (title.length < 20 || tags.length < 5 || description.length < 50)
            return Response.json(
              { error: "The AI answer was incomplete. Try again." },
              { status: 502 },
            );
          return Response.json({ title, tags, description });
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
