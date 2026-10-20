import { createFileRoute } from "@tanstack/react-router";
import { checkAdobePolicy, ADOBE_NEGATIVE_CLAUSE } from "@/lib/adobe-stock/policy";

// Google Veo (via Gemini API) is currently the cheapest production-quality
// text-to-video API ($/sec) and supports 1080p / up to 8 sec per clip.
// We use Veo 3 Fast by default; users can request the higher-quality model.
//
// Veo runs as a long-running operation: kick it off, then poll until done.
//
// This route supports two actions:
//   POST { action: "start", prompt, duration, model? } -> { operation }
//   POST { action: "poll",  operation }                -> { done, videoUrl?, error? }

type StartBody = {
  action: "start";
  prompt: string;
  duration?: number;
  model?: string;
  imageBase64?: string;
  imageMime?: string;
};
type PollBody = { action: "poll"; operation: string };

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function pickKey(request: Request): { key?: string; source: "header" | "env" } {
  const headerKey = request.headers.get("x-ai-key")?.trim();
  if (headerKey) return { key: headerKey, source: "header" };
  return { key: process.env.GEMINI_API_KEY, source: "env" };
}

export const Route = createFileRoute("/api/adobe-stock-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as StartBody | PollBody;
          const { key } = pickKey(request);
          if (!key)
            return Response.json(
              { error: "Missing Gemini API key. Add GEMINI_API_KEY or paste it in Settings." },
              { status: 401 },
            );

          if (body.action === "start") {
            const policy = checkAdobePolicy(body.prompt);
            if (!policy.ok) return Response.json({ error: policy.reason }, { status: 400 });

            const model = body.model || "veo-3.0-fast-generate-001";
            const duration = Math.min(8, Math.max(4, body.duration ?? 8));

            const fullPrompt = `${body.prompt}.\nCinematic 1080p footage, smooth camera motion, professional color grading, suitable for Adobe Stock licensing.\n${ADOBE_NEGATIVE_CLAUSE}`;

            const url = `${GEMINI_BASE}/models/${model}:predictLongRunning?key=${encodeURIComponent(key)}`;
            const instance: Record<string, unknown> = { prompt: fullPrompt };
            if (body.imageBase64) {
              instance.image = {
                bytesBase64Encoded: body.imageBase64,
                mimeType: body.imageMime || "image/jpeg",
              };
            }
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [instance],
                parameters: {
                  aspectRatio: "16:9",
                  durationSeconds: duration,
                  personGeneration: "dont_allow",
                  resolution: "1080p",
                },
              }),
            });
            if (!res.ok) {
              const txt = await res.text();
              return Response.json(
                { error: `Veo start failed: ${txt.slice(0, 400)}` },
                { status: res.status },
              );
            }
            const j = (await res.json()) as { name?: string };
            if (!j.name)
              return Response.json(
                { error: "Veo did not return an operation name" },
                { status: 502 },
              );
            return Response.json({ operation: j.name });
          }

          if (body.action === "poll") {
            const url = `${GEMINI_BASE}/${body.operation}?key=${encodeURIComponent(key)}`;
            const res = await fetch(url);
            if (!res.ok) {
              const txt = await res.text();
              return Response.json(
                { error: `Veo poll failed: ${txt.slice(0, 400)}` },
                { status: res.status },
              );
            }
            const j = (await res.json()) as {
              done?: boolean;
              error?: { message?: string };
              response?: {
                generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] };
              };
            };
            if (j.error?.message) return Response.json({ done: true, error: j.error.message });
            if (!j.done) return Response.json({ done: false });

            const uri = j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
            if (!uri) return Response.json({ done: true, error: "Veo returned no video URI" });

            // The URI is a Files API URL — fetch with key, return as base64 (Adobe Stock max 3.9 GB,
            // but Veo clips are tens of MB so this is fine).
            const vidRes = await fetch(
              `${uri}${uri.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`,
            );
            if (!vidRes.ok) {
              return Response.json({
                done: true,
                error: `Failed to download Veo video: ${vidRes.status}`,
              });
            }
            const buf = await vidRes.arrayBuffer();
            const b64 = Buffer.from(buf).toString("base64");
            return Response.json({
              done: true,
              videoBase64: b64,
              mime: vidRes.headers.get("content-type") || "video/mp4",
            });
          }

          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
