import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callImage, statusFromError } from "@/lib/ai-call.server";

export const Route = createFileRoute("/api/generate-design")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = (await request.json()) as { prompt: string };
          if (!prompt) return Response.json({ error: "Missing prompt" }, { status: 400 });

          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          const fullPrompt = `Create a premium, print-ready digital design for an Etsy digital download: ${prompt}.
Style: follow any art style named in the request (watercolor, line art, retro, kawaii, vintage, photographic, etc.). If no style is named, use a polished, highly detailed illustration with rich color and clean shapes that suits print-on-demand (t-shirts, mugs, stickers, wall art).
Composition: one complete design, centered, fully inside the frame with generous margin on every side, nothing cropped at the edges, 1:1 square.
Background: perfectly flat pure white (#FFFFFF) with no shadow, gradient, texture, floor, or vignette, so the background can be removed cleanly for a transparent PNG.
Quality: tack-sharp edges, crisp linework, smooth clean color fills, no noise, no blur, no compression artifacts.
Do not add borders, frames, mockup products, watermarks, signatures, or logos. Only include lettering if the request asks for specific text, and spell it exactly.
Original artwork only: no trademarks, brands, or copyrighted characters.`;

          // Design files are what the customer downloads, so request a hi-res native render.
          // 2K keeps the base64 payload small enough for remove.bg and mockup edits; exports are
          // then resampled to 4096px+ on the client.
          const b64 = await callImage({
            provider,
            key,
            prompt: fullPrompt,
            aspectRatio: "1:1",
            hires: true,
            imageSize: "2K",
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
