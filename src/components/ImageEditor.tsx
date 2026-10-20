import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, RotateCcw, Wand2 } from "lucide-react";
import { bakeEdits, DEFAULT_EDITS, type ImageEdits } from "@/lib/image-edits";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  srcB64: string;
  edits: ImageEdits;
  onSave: (e: ImageEdits) => void;
  canRegenerate?: boolean;
  onRegenerate?: (tweak: string) => Promise<void>;
  regenerating?: boolean;
};

export function ImageEditor({
  open,
  onOpenChange,
  title,
  srcB64,
  edits,
  onSave,
  canRegenerate,
  onRegenerate,
  regenerating,
}: Props) {
  const [draft, setDraft] = useState<ImageEdits>(edits);
  const [preview, setPreview] = useState<string | null>(null);
  const [tweak, setTweak] = useState("");
  const previewRef = useRef<number>(0);

  useEffect(() => {
    setDraft(edits);
  }, [edits, open]);

  // Live preview (debounced + downscaled for speed)
  useEffect(() => {
    if (!open) return;
    const id = ++previewRef.current;
    const t = setTimeout(async () => {
      try {
        const blob = await bakeEdits(srcB64, draft, 700, "image/jpeg", 0.85);
        if (id !== previewRef.current) return;
        const url = URL.createObjectURL(blob);
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      } catch (e) {
        console.error(e);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [draft, srcB64, open]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const set = <K extends keyof ImageEdits>(k: K, v: ImageEdits[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const reset = () =>
    setDraft({ ...DEFAULT_EDITS, filename: draft.filename, include: draft.include });

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(edits), [draft, edits]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit — {title}</DialogTitle>
          <DialogDescription>
            All changes are non-destructive. They bake into the final image when you download the
            ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-center rounded-md border border-border bg-[conic-gradient(at_top_left,_#e5e7eb_25%,_transparent_25%,_transparent_50%,_#e5e7eb_50%,_#e5e7eb_75%,_transparent_75%)] bg-[length:20px_20px] p-3">
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-[60vh] max-w-full object-contain"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering…
                </div>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Live preview (downscaled). Final export is full resolution.
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="inc">Include in ZIP</Label>
                <p className="text-xs text-muted-foreground">Toggle off to skip this image.</p>
              </div>
              <Switch id="inc" checked={draft.include} onCheckedChange={(v) => set("include", v)} />
            </div>

            <div>
              <Label htmlFor="fn">Filename (no extension)</Label>
              <Input
                id="fn"
                className="mt-1.5"
                value={draft.filename}
                onChange={(e) => set("filename", e.target.value)}
                placeholder="my-mockup"
              />
            </div>

            <section className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Color tuning</h4>
              <SliderRow
                label="Brightness"
                value={draft.brightness}
                min={50}
                max={150}
                onChange={(v) => set("brightness", v)}
                suffix="%"
              />
              <SliderRow
                label="Contrast"
                value={draft.contrast}
                min={50}
                max={150}
                onChange={(v) => set("contrast", v)}
                suffix="%"
              />
              <SliderRow
                label="Saturation"
                value={draft.saturate}
                min={0}
                max={200}
                onChange={(v) => set("saturate", v)}
                suffix="%"
              />
            </section>

            <section className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Crop & zoom</h4>
              <div>
                <Label className="text-xs">Aspect ratio</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["original", "1:1", "4:5", "16:9", "9:16"] as const).map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={draft.cropRatio === r ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => set("cropRatio", r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
              <SliderRow
                label="Zoom"
                value={Math.round(draft.zoom * 100)}
                min={100}
                max={300}
                onChange={(v) => set("zoom", v / 100)}
                suffix="%"
              />
              <SliderRow
                label="Pan X"
                value={Math.round(draft.offsetX * 100)}
                min={-100}
                max={100}
                onChange={(v) => set("offsetX", v / 100)}
                suffix=""
              />
              <SliderRow
                label="Pan Y"
                value={Math.round(draft.offsetY * 100)}
                min={-100}
                max={100}
                onChange={(v) => set("offsetY", v / 100)}
                suffix=""
              />
            </section>

            <section className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Background & frame</h4>
              <div className="grid grid-cols-2 gap-2">
                <ColorRow
                  label="BG color"
                  value={draft.bgColor}
                  onChange={(v) => set("bgColor", v)}
                  placeholder="auto"
                />
                <ColorRow
                  label="Frame"
                  value={draft.frameColor}
                  onChange={(v) => set("frameColor", v)}
                  placeholder="none"
                />
              </div>
              <SliderRow
                label="Frame width"
                value={draft.frameWidth}
                min={0}
                max={80}
                onChange={(v) => set("frameWidth", v)}
                suffix="px"
              />
            </section>

            <section className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Text banners</h4>
              <div>
                <Label className="text-xs">Top banner text</Label>
                <Input
                  className="mt-1.5"
                  value={draft.bannerTop}
                  onChange={(e) => set("bannerTop", e.target.value)}
                  placeholder="BEST QUALITY INSTANT DOWNLOAD"
                />
              </div>
              <div>
                <Label className="text-xs">Bottom banner text</Label>
                <Input
                  className="mt-1.5"
                  value={draft.bannerBottom}
                  onChange={(e) => set("bannerBottom", e.target.value)}
                  placeholder="SVG • PNG • PDF • JPG"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ColorRow
                  label="Banner color"
                  value={draft.bannerColor}
                  onChange={(v) => set("bannerColor", v)}
                />
                <ColorRow
                  label="Text color"
                  value={draft.bannerTextColor}
                  onChange={(v) => set("bannerTextColor", v)}
                />
              </div>
              <SliderRow
                label="Banner height"
                value={draft.bannerHeightPct}
                min={4}
                max={25}
                onChange={(v) => set("bannerHeightPct", v)}
                suffix="%"
              />
              <SliderRow
                label="Banner font size"
                value={draft.bannerFontPx}
                min={20}
                max={140}
                onChange={(v) => set("bannerFontPx", v)}
                suffix="px"
              />
            </section>

            {canRegenerate && onRegenerate && (
              <section className="space-y-2 rounded-md border border-border p-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" /> Regenerate with tweak
                </h4>
                <Textarea
                  rows={2}
                  placeholder="e.g. darker background, wooden table instead of wall, warmer lighting"
                  value={tweak}
                  onChange={(e) => setTweak(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={regenerating || !tweak.trim()}
                  onClick={() => onRegenerate(tweak.trim())}
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Re-rendering…
                    </>
                  ) : (
                    "Regenerate this image"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Replaces the source image. Your overlay edits stay.
                </p>
              </section>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={reset} className="mr-auto">
            <RotateCcw className="h-4 w-4" /> Reset edits
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
            disabled={!dirty && draft === edits}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5 flex gap-1.5">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border border-input bg-background"
        />
        <Input
          value={value}
          placeholder={placeholder || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-xs"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
