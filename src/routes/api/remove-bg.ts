import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/remove-bg")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { image } = (await request.json()) as { image: string };
          if (!image) return Response.json({ error: "Missing image" }, { status: 400 });

          const overrideKey = request.headers.get("x-removebg-key")?.trim();
          const apiKey = overrideKey || process.env.REMOVE_BG_API_KEY;
          if (!apiKey)
            return Response.json(
              { error: "Missing REMOVE_BG_API_KEY. Add it in Settings." },
              { status: 500 },
            );

          const res = await fetch("https://api.remove.bg/v1.0/removebg", {
            method: "POST",
            headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ image_file_b64: image, size: "auto", format: "png" }),
          });

          if (!res.ok) {
            const text = await res.text();
            return Response.json(
              { error: `remove.bg error: ${text.slice(0, 200)}` },
              { status: 500 },
            );
          }
          const buf = await res.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          return Response.json({ image: b64 });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
