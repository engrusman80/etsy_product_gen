import { createFileRoute } from "@tanstack/react-router";
import { resolveTextProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { IP_RULES, findProtectedTerm } from "@/lib/ip-guard";

type Keyword = { keyword: string; why: string; sources: { title: string; url: string }[] };

/**
 * Today's crochet pattern keywords: the AI searches the web for what crochet buyers want now,
 * then the browser measures each phrase on Etsy. Falls back to the AI's own knowledge when the
 * key cannot search (a free Gemini key has no Google Search).
 */
export const Route = createFileRoute("/api/trend-keywords")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { avoid = [], count = 10 } = (await request.json()) as {
            avoid?: string[];
            count?: number;
          };
          const { provider, key } = resolveTextProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const n = Math.min(12, Math.max(5, count));
          const system = `You research Etsy demand for crochet PATTERN PDFs (digital downloads, not finished items). Today is ${today}.
Find ${n} specific search phrases a buyer would type into Etsy for a crochet pattern that is wanted now or over the next 4-8 weeks but has few Etsy pattern listings yet. Look at TikTok, Pinterest and Instagram crochet trends, fashion and accessory trend reports for the coming season, and upcoming holidays. Prefer a clear item plus a trending style or stitch over broad phrases.
${IP_RULES}
Return ONLY JSON: { "keywords": [ { "keyword": string, "why": string, "sources": [ { "title": string, "url": string } ] } ] }
"keyword": 3-7 words, lowercase, ends with "pattern", e.g. "crochet pillbox hat pattern".
"why": one short sentence on the demand evidence (which trend, where you saw it).
"sources": up to 2 pages you actually read that show the trend; an empty list if none.`;
          const recent = avoid.slice(-150);
          const user = `Keywords for today.${recent.length ? `\nDo not repeat or closely reword any of these earlier keywords:\n${recent.join("\n")}` : ""}`;

          let searched = true;
          let raw: string;
          try {
            raw = await callText({ provider, key, system, user, json: true, webSearch: true });
          } catch (e) {
            // Claude always can search; Gemini's free tier and some keys cannot, so ask without it.
            if (provider === "anthropic" || statusFromError(e) === 401) throw e;
            searched = false;
            raw = await callText({
              provider,
              key,
              system: `${system}\nYou cannot search the web right now: use what you know about current crochet trends and leave "sources" empty.`,
              user,
              json: true,
            });
          }
          const j = JSON.parse(
            raw
              .trim()
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/```$/i, "")
              .trim() || "{}",
          ) as { keywords?: Partial<Keyword>[] };
          const seen = new Set(avoid.map((a) => a.toLowerCase().trim()));
          const keywords: Keyword[] = [];
          for (const k of j.keywords ?? []) {
            const keyword = String(k.keyword ?? "")
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim();
            if (!keyword || seen.has(keyword) || findProtectedTerm(keyword)) continue;
            seen.add(keyword);
            const sources = (Array.isArray(k.sources) ? k.sources : [])
              .map((s) => ({
                title: String(s?.title ?? "").slice(0, 120),
                url: String(s?.url ?? ""),
              }))
              .filter((s) => /^https?:\/\//.test(s.url))
              .slice(0, 2);
            keywords.push({ keyword, why: String(k.why ?? "").trim(), sources });
          }
          if (!keywords.length)
            return Response.json({ error: "No keywords came back. Try again." }, { status: 502 });
          return Response.json({ keywords, searched, provider });
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
