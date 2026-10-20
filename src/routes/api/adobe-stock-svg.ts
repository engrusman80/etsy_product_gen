import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";
import { checkAdobePolicy, ADOBE_NEGATIVE_CLAUSE } from "@/lib/adobe-stock/policy";
import { originalitySeed } from "@/lib/adobe-stock/originality";

export const Route = createFileRoute("/api/adobe-stock-svg")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, artboard } = (await request.json()) as { prompt: string; artboard?: number };
          if (!prompt) return Response.json({ error: "Missing prompt" }, { status: 400 });

          const policy = checkAdobePolicy(prompt);
          if (!policy.ok) return Response.json({ error: policy.reason }, { status: 400 });

          // Default Adobe-compliant artboard ≈ 4000×4000 → 16 MP (min 15, max 65).
          const size = Math.min(8000, Math.max(3873, artboard ?? 4000));

          const { provider, key } = resolveProvider(request);
          if (!key) return Response.json({ error: `Missing API key for ${provider}. Add it in Settings.` }, { status: 401 });

          const sys = `You are a senior vector illustrator producing Adobe Stock-grade SVG artwork.
Output ONLY a single valid <svg>...</svg> document — no markdown fences, no commentary, no <!DOCTYPE>.
Required attributes: xmlns="http://www.w3.org/2000/svg", width="${size}", height="${size}", viewBox="0 0 ${size} ${size}".
Use clean, layered <path>/<rect>/<circle>/<polygon>/<g> elements with id labels per logical layer.
NO embedded raster images (no <image>, no base64), NO external fonts (convert any text to paths or omit).
Build the composition as crisp flat-vector illustration with rich detail, balanced negative space, and a cohesive color palette.
Adobe Stock compliance: ${ADOBE_NEGATIVE_CLAUSE}`;

          const svg = await callText({
            provider,
            key,
            system: sys,
            user: `Create an editable layered SVG artwork: ${prompt}\n\n${originalitySeed()}\nDeliver an original composition — do NOT imitate existing popular stock designs.`,
            tier: "fast",
          });

          // Strip any accidental fences.
          const cleaned = svg
            .replace(/^```(?:svg|xml)?\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          const match = cleaned.match(/<svg[\s\S]*<\/svg>/i);
          if (!match) return Response.json({ error: "Model did not return a valid <svg> document." }, { status: 502 });

          return Response.json({ svg: match[0], size });
        } catch (e) {
          const status = statusFromError(e);
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
