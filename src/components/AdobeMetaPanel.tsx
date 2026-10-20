import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Copy, Check, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export type AdobeMeta = {
  title: string;
  filename: string;
  description: string;
  keywords: string[];
  category: string;
};

type Props = {
  prompt: string;
  assetType: "jpeg" | "png" | "svg" | "video";
  headers: () => HeadersInit;
  /** Parent uses this filename when downloading the asset. */
  onFilenameChange?: (filename: string) => void;
  /** When set (e.g. asset creation timestamp), auto-generates metadata whenever the value changes. */
  autoTriggerKey?: string | number | null;
};

export function AdobeMetaPanel({
  prompt,
  assetType,
  headers,
  onFilenameChange,
  autoTriggerKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AdobeMeta | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const lastAutoKey = useRef<string | number | null>(null);

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/adobe-stock-meta", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ prompt, assetType }),
      });
      const text = await res.text();
      let j: AdobeMeta & { error?: string } = {} as AdobeMeta;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`Server ${res.status}: ${text.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(j.error || "Metadata generation failed");
      setMeta(j);
      onFilenameChange?.(j.filename);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate metadata when the parent signals (e.g. right after an image renders).
  useEffect(() => {
    if (autoTriggerKey == null) return;
    if (lastAutoKey.current === autoTriggerKey) return;
    if (!prompt.trim()) return;
    lastAutoKey.current = autoTriggerKey;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerKey]);

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const updateFilename = (v: string) => {
    if (!meta) return;
    const clean = v
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setMeta({ ...meta, filename: clean });
    onFilenameChange?.(clean);
  };

  return (
    <div className="rounded-md border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Adobe Stock SEO metadata</span>
          <Badge variant="secondary" className="text-[10px]">
            high-demand keywords
          </Badge>
        </div>
        <Button
          size="sm"
          variant={meta ? "outline" : "default"}
          onClick={generate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {meta ? "Regenerate" : "Generate metadata"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {meta && (
        <div className="space-y-3 text-sm">
          <Field
            label="Title"
            value={meta.title}
            onCopy={() => copy("title", meta.title)}
            copied={copied === "title"}
          >
            <p className="text-xs text-muted-foreground">{meta.title.length}/70 characters</p>
          </Field>

          <Field
            label="Filename"
            value={`${meta.filename}.${extFor(assetType)}`}
            onCopy={() => copy("filename", meta.filename)}
            copied={copied === "filename"}
          >
            <Input
              value={meta.filename}
              onChange={(e) => updateFilename(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">Used for the download filename.</p>
          </Field>

          <Field
            label="Description"
            value={meta.description}
            onCopy={() => copy("desc", meta.description)}
            copied={copied === "desc"}
          >
            <Textarea value={meta.description} readOnly className="text-sm min-h-[60px]" />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-medium">
                Keywords ({meta.keywords.length}/50) — ordered by priority
              </Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => copy("kw", meta.keywords.join(", "))}
              >
                {copied === "kw" ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy all
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto rounded bg-background p-2 border">
              {meta.keywords.map((k, i) => (
                <Badge
                  key={i}
                  variant={i < 10 ? "default" : "secondary"}
                  className="text-[11px] font-normal"
                >
                  {i < 10 && <span className="opacity-60 mr-1">{i + 1}.</span>}
                  {k}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              First 10 keywords (highlighted) drive most of Adobe's relevance ranking.
            </p>
          </div>

          <Field
            label="Category"
            value={meta.category}
            onCopy={() => copy("cat", meta.category)}
            copied={copied === "cat"}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  copied,
  children,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">{label}</Label>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          Copy
        </Button>
      </div>
      {children ?? <p className="text-sm bg-background rounded border px-2 py-1.5">{value}</p>}
    </div>
  );
}

function extFor(t: "jpeg" | "png" | "svg" | "video"): string {
  if (t === "jpeg") return "jpg";
  if (t === "video") return "mp4";
  return t;
}
