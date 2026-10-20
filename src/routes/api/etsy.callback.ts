import { createFileRoute } from "@tanstack/react-router";

/** Some setups register /api/etsy/callback with Etsy; hand those sign-ins to the page. */
export const Route = createFileRoute("/api/etsy/callback")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        url.searchParams.set("via", "api");
        return Response.redirect(`${url.origin}/etsy/callback?${url.searchParams}`, 302);
      },
    },
  },
});
