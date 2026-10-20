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

          const fullPrompt = `Create ultra high-resolution print-ready artwork for an Etsy listing: ${prompt}.
Centered subject on a clean solid pure-white background. No extra text, no watermarks, no borders, no frames. Ultra-realistic, extremely detailed, lifelike textures, professional cinematic lighting, tack-sharp crisp edges, 1:1 square composition, 8K photorealistic quality. Do NOT generate cartoon, vector, illustration, or 3d render styles unless explicitly requested. Suitable for premium print-on-demand t-shirts, mugs, posters and stickers.`;

          const b64 = await callImage({ provider, key, prompt: fullPrompt });
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
