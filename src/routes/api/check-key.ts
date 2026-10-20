import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callText, statusFromError } from "@/lib/ai-call.server";

/** Tiny text call so the Settings page can confirm a key works before a real run. */
export const Route = createFileRoute("/api/check-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { provider, key } = resolveProvider(request);
        if (!key) return Response.json({ ok: false, error: "No key entered." }, { status: 400 });
        try {
          await callText({ provider, key, user: "Reply with the single word OK." });
          return Response.json({ ok: true });
        } catch (e) {
          const status = statusFromError(e) || 500;
          const raw = (e as Error).message || "Key check failed";
          const error =
            status === 401 || status === 403 || /API key not valid|invalid.*key/i.test(raw)
              ? "This key was rejected. Copy it again from the provider's website."
              : status === 429
                ? "The key works but is rate-limited right now. Try again in a minute."
                : raw.slice(0, 300);
          return Response.json({ ok: false, error }, { status: 200 });
        }
      },
    },
  },
});
