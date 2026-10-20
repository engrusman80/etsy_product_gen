import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callImage, statusFromError } from "@/lib/ai-call.server";
import { checkAdobePolicy, ADOBE_NEGATIVE_CLAUSE } from "@/lib/adobe-stock/policy";
import { originalitySeed, SHARPNESS_CLAUSE } from "@/lib/adobe-stock/originality";

/** Simple heuristic: is the requested subject better rendered as a vector (SVG)? */
function looksVectorish(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return /\b(logo|icon|flat\s+illustration|vector|infographic|pictogram|badge|emblem|monogram|line[- ]art|geometric|pattern|clipart|clip[- ]art)\b/.test(p);
}

export const Route = createFileRoute("/api/adobe-stock-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, mode, aspect, hires } = (await request.json()) as {
            prompt: string;
            mode: "jpeg" | "png";
            aspect?: string;
            hires?: boolean;
          };
          if (!prompt) return Response.json({ error: "Missing prompt" }, { status: 400 });

          const policy = checkAdobePolicy(prompt);
          if (!policy.ok) return Response.json({ error: policy.reason }, { status: 400 });

          const stylePrefix =
            mode === "png"
              ? `Subject isolated on a CLEAN PURE WHITE background (so it can be cleanly cut out to transparent). Centered composition, no shadow on background, razor-sharp anti-aliased edges suitable for vector-like cutout.`
              : `Ultra-detailed photorealistic or premium illustration suitable for Adobe Stock JPEG submission. Print-grade 8K quality, professional studio lighting, rich detail in shadows and highlights, no motion blur, no compression artifacts, magazine-quality composition.`;

          const vectorHint = looksVectorish(prompt)
            ? "Render as clean flat-vector-style artwork: solid fills, precise geometric shapes, uniform stroke weights, no photographic noise, no gradients unless smoothly banded, no raster texture — output must look like it was drawn in Adobe Illustrator."
            : "";

          const fullPrompt = [
            stylePrefix,
            `Subject: ${prompt}.`,
            vectorHint,
            SHARPNESS_CLAUSE,
            originalitySeed(),
            ADOBE_NEGATIVE_CLAUSE,
            "Deliver a truly original composition — not derivative of existing stock imagery. Maximum native resolution and detail density.",
          ].filter(Boolean).join("\n");

          const { provider, key } = resolveProvider(request);
          if (!key) return Response.json({ error: `Missing API key for ${provider}. Add it in Settings.` }, { status: 401 });

          const b64 = await callImage({ provider, key, prompt: fullPrompt, aspectRatio: aspect, hires: hires ?? true });
          return Response.json({ image: b64, provider, vectorSuggested: looksVectorish(prompt) });
        } catch (e) {
          const status = statusFromError(e);
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
