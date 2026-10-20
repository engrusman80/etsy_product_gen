import { createFileRoute } from "@tanstack/react-router";
import {
  EtsyError,
  createDraft,
  credsFrom,
  exchangeCode,
  getActiveListings,
  getMyShop,
  refreshTokens,
  updateListing,
  type DraftInput,
} from "@/lib/etsy/api.server";

type Body =
  | { action: "token"; code: string; verifier: string; redirectUri: string }
  | { action: "refresh"; refreshToken: string }
  | { action: "shop" }
  | { action: "listings"; shopId: number }
  | {
      action: "update";
      shopId: number;
      listingId: number;
      fields: { title?: string; description?: string; tags?: string[] };
    }
  | { action: "draft"; shopId: number; draft: DraftInput };

/** One endpoint for the Etsy page, Settings and the draft buttons. Drafts are never published. */
export const Route = createFileRoute("/api/etsy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const creds = credsFrom(request);
        try {
          const body = (await request.json()) as Body;
          switch (body.action) {
            case "token":
              return Response.json(
                await exchangeCode(creds, body.code, body.verifier, body.redirectUri),
              );
            case "refresh":
              return Response.json(await refreshTokens(creds, body.refreshToken));
            case "shop":
              return Response.json(await getMyShop(creds));
            case "listings":
              return Response.json({ listings: await getActiveListings(creds, body.shopId) });
            case "update":
              await updateListing(creds, body.shopId, body.listingId, body.fields);
              return Response.json({ ok: true });
            case "draft":
              return Response.json(await createDraft(creds, body.shopId, body.draft));
            default:
              return Response.json({ error: "Unknown action" }, { status: 400 });
          }
        } catch (e) {
          const status = e instanceof EtsyError ? e.status : 500;
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
