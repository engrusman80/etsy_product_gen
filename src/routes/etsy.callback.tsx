import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { finishEtsyConnect } from "@/lib/etsy/client";

export const Route = createFileRoute("/etsy/callback")({
  head: () => ({ meta: [{ title: "Connecting Etsy · Digital Product AI Automation" }] }),
  component: EtsyCallback,
});

/** Etsy sends the user back here after "Allow access". */
function EtsyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state") || "";
    if (!code) {
      setError(q.get("error_description") || q.get("error") || "Etsy did not return a code.");
      return;
    }
    finishEtsyConnect(code, state, q.get("via") === "api")
      .then(() => navigate({ to: "/etsy" }))
      .catch((e: Error) => setError(e.message));
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="paper-card max-w-md p-8 text-center">
        {error ? (
          <>
            <h1 className="font-display text-xl font-semibold">Etsy connection failed</h1>
            <p className="mt-2 text-sm text-destructive">{error}</p>
            <Link to="/settings" className="mt-4 inline-block text-sm underline">
              Back to Settings
            </Link>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting your Etsy shop…
          </p>
        )}
      </div>
    </div>
  );
}
