import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callImage, statusFromError } from "@/lib/ai-call.server";
import { getProductType, type Background } from "@/lib/product-types";

const BACKGROUND_RULES: Record<Background, string> = {
  transparent:
    "Background: perfectly flat pure white (#FFFFFF) with no shadow, gradient, texture, floor, or vignette, so the background can be removed cleanly for a transparent PNG.",
  white:
    "Background: clean pure white paper (#FFFFFF), flat and evenly lit, no shadow, no paper texture, no desk or photo of paper, the page itself is the image.",
  full: "Background: the artwork fills the entire canvas edge to edge (full bleed). Do not show it as a print, poster, product, frame, wall, or photo; the image itself is the printable file.",
};

export const Route = createFileRoute("/api/generate-design")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, productType } = (await request.json()) as {
            prompt: string;
            productType?: string;
          };
          if (!prompt) return Response.json({ error: "Missing prompt" }, { status: 400 });

          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          const type = getProductType(productType);
          const margin =
            type.background === "full"
              ? "Composition: one complete design that uses the whole canvas, important elements kept away from the outer 3% so nothing is lost when printed and trimmed."
              : "Composition: centered, fully inside the frame with generous margin on every side, nothing cropped at the edges.";
          const fullPrompt = `Create a premium, print-ready Etsy digital download. Product type: ${type.label}. Request: ${prompt}.
Product requirements: ${type.art}
Style: follow any art style named in the request (watercolor, line art, retro, kawaii, vintage, photographic, etc.). If no style is named, use a polished, highly detailed style with clean shapes that suits this product type.
${margin} Aspect ratio ${type.aspectRatio}.
${BACKGROUND_RULES[type.background]}
Quality: tack-sharp edges, crisp linework, smooth clean color fills, no noise, no blur, no compression artifacts.
Do not add mockup products, watermarks, signatures, or logos. Only include lettering if the request or the product type needs it, and spell it exactly.
Original artwork only: no trademarks, brands, or copyrighted characters.`;

          // The design is the file the customer buys, so render it natively at 4K (4096px on
          // Gemini 3 Pro Image). The client shrinks copies before sending them to remove.bg/mockups.
          const b64 = await callImage({
            provider,
            key,
            prompt: fullPrompt,
            aspectRatio: type.aspectRatio,
            hires: true,
            imageSize: "4K",
          });
          return Response.json({ image: b64 });
        } catch (e) {
          const status = statusFromError(e);
          const msg = (e as Error).message || "Image generation failed";
          if (status === 429)
            return Response.json({ error: "Rate limit reached. Try again shortly." }, { status });
          if (status === 402) return Response.json({ error: "AI credits exhausted." }, { status });
          if (status === 401)
            return Response.json({ error: "Invalid API key. Check Settings." }, { status });
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
