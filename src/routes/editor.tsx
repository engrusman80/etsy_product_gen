import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const CanvasStudio = lazy(() => import("@/components/editor/CanvasStudio"));

type Search = { src?: string; back?: string; key?: string; demo?: string };

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Image Studio — full editor" },
      {
        name: "description",
        content:
          "Edit any image with layers, text in 20+ languages, shapes, drawing, colors, fonts, RTL support, print-ready export, and autosave.",
      },
    ],
  }),
  validateSearch: (s): Search => ({
    src: typeof s.src === "string" ? s.src : undefined,
    back: typeof s.back === "string" ? s.back : undefined,
    key: typeof s.key === "string" ? s.key : undefined,
    demo: typeof s.demo === "string" ? s.demo : undefined,
  }),
  component: EditorPage,
});

function EditorPage() {
  const search = useSearch({ from: "/editor" });
  const navigate = useNavigate();
  const [initialImage, setInitialImage] = useState<string | undefined>();
  const [loadDemo, setLoadDemo] = useState(false);

  useEffect(() => {
    if (search.demo === "1") {
      setLoadDemo(true);
      return;
    }
    if (search.src) {
      setInitialImage(search.src);
      return;
    }
    if (search.key && typeof window !== "undefined") {
      // localStorage (works across tabs); fall back to sessionStorage for legacy callers.
      const v = localStorage.getItem(search.key) ?? sessionStorage.getItem(search.key);
      if (v) setInitialImage(v);
    }
  }, [search.src, search.key, search.demo]);

  const handleApply = (dataUrl: string) => {
    if (search.key && typeof window !== "undefined") {
      localStorage.setItem(`${search.key}:out`, dataUrl);
      try {
        const ch = new BroadcastChannel("image-studio");
        ch.postMessage({ key: search.key, dataUrl });
        ch.close();
      } catch {
        /* ignore */
      }
    }
    if (search.back) navigate({ to: search.back });
    else navigate({ to: "/" });
  };

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading studio…
        </div>
      }
    >
      <CanvasStudio
        initialImage={initialImage}
        demoOnEmpty={loadDemo}
        onApply={search.key ? handleApply : undefined}
      />
    </Suspense>
  );
}
