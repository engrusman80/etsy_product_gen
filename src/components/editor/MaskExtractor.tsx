// Manual mask tool — magic wand (color flood-fill) + brush paint/erase.
// User picks a region of the source image; on "Extract", the masked pixels
// become a new transparent PNG returned to the parent so Studio can drop
// them in as a separate Fabric layer (Canva-style).

import { useEffect, useMemo, useRef, useState } from "react";
import { Brush, Eraser, MousePointer2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type Mode = "wand" | "brush" | "erase";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Source image to mask (data URL or http URL). */
  src: string;
  /** Called with the extracted transparent-PNG data URL + optional "cut" residual (original minus mask). */
  onExtract: (payload: { layerDataUrl: string; cutSourceDataUrl?: string }) => void;
};

const DISPLAY_MAX = 800;

export function MaskExtractor({ open, onOpenChange, src, onExtract }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null); // shows the image
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); // red overlay (display only)
  const interactRef = useRef<HTMLDivElement>(null);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 600, h: 600 });
  const [mode, setMode] = useState<Mode>("wand");
  const [tolerance, setTolerance] = useState(28); // 0..120 RGB distance
  const [brushSize, setBrushSize] = useState(40); // display px
  const [contiguous, setContiguous] = useState(true);
  const [cutFromSource, setCutFromSource] = useState(true);
  const [hasMask, setHasMask] = useState(false);

  // Full-res mask buffer (1 byte per pixel)
  const maskBufRef = useRef<Uint8Array | null>(null);
  // Full-res image pixel buffer for sampling
  const pixelsRef = useRef<Uint8ClampedArray | null>(null);

  const scale = useMemo(() => {
    if (!imgSize) return 1;
    return Math.min(1, DISPLAY_MAX / Math.max(imgSize.w, imgSize.h));
  }, [imgSize]);

  // Load image + setup canvases
  useEffect(() => {
    if (!open || !src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const w = img.naturalWidth, h = img.naturalHeight;
      setImgSize({ w, h });
      const s = Math.min(1, DISPLAY_MAX / Math.max(w, h));
      const dw = Math.round(w * s), dh = Math.round(h * s);
      setDisplaySize({ w: dw, h: dh });

      // Draw display
      const bc = baseCanvasRef.current!;
      bc.width = dw; bc.height = dh;
      bc.getContext("2d")!.drawImage(img, 0, 0, dw, dh);

      // Init mask overlay
      const mc = maskCanvasRef.current!;
      mc.width = dw; mc.height = dh;
      mc.getContext("2d")!.clearRect(0, 0, dw, dh);

      // Read full-res pixels once
      const full = document.createElement("canvas");
      full.width = w; full.height = h;
      const fctx = full.getContext("2d", { willReadFrequently: true })!;
      fctx.drawImage(img, 0, 0);
      pixelsRef.current = fctx.getImageData(0, 0, w, h).data;
      maskBufRef.current = new Uint8Array(w * h);
      setHasMask(false);
    };
    img.onerror = () => alert("Could not load this image for masking. (Cross-origin blocked?)");
    img.src = src;
    return () => { cancelled = true; };
  }, [open, src]);

  const repaintOverlay = () => {
    const mask = maskBufRef.current;
    const size = imgSize;
    if (!mask || !size) return;
    const mc = maskCanvasRef.current!;
    const dw = mc.width, dh = mc.height;
    const ctx = mc.getContext("2d")!;
    const out = ctx.createImageData(dw, dh);
    // Downsample mask for display
    for (let y = 0; y < dh; y++) {
      const srcY = Math.floor((y / dh) * size.h);
      for (let x = 0; x < dw; x++) {
        const srcX = Math.floor((x / dw) * size.w);
        const m = mask[srcY * size.w + srcX];
        const i = (y * dw + x) * 4;
        if (m) {
          out.data[i] = 255; out.data[i + 1] = 64; out.data[i + 2] = 64; out.data[i + 3] = 120;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    setHasMask(mask.some((v) => v > 0));
  };

  // Magic wand flood fill from full-res pixel
  const magicWand = (px: number, py: number) => {
    const size = imgSize; const data = pixelsRef.current; const mask = maskBufRef.current;
    if (!size || !data || !mask) return;
    const w = size.w, h = size.h;
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const startIdx = (py * w + px) * 4;
    const tr = data[startIdx], tg = data[startIdx + 1], tb = data[startIdx + 2];
    const tol2 = tolerance * tolerance * 3; // squared distance budget

    if (!contiguous) {
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb;
        if (dr * dr + dg * dg + db * db <= tol2 && data[i + 3] > 8) mask[p] = 1;
      }
      repaintOverlay();
      return;
    }

    // BFS flood fill (4-connected), cap iterations for safety
    const stack: number[] = [px, py];
    const maxPixels = w * h;
    let visited = 0;
    while (stack.length && visited < maxPixels) {
      const y = stack.pop()!; const x = stack.pop()!;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = y * w + x;
      if (mask[p]) continue;
      const i = p * 4;
      if (data[i + 3] < 8) continue;
      const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      mask[p] = 1; visited++;
      stack.push(x + 1, y); stack.push(x - 1, y);
      stack.push(x, y + 1); stack.push(x, y - 1);
    }
    repaintOverlay();
  };

  // Brush paint/erase at full-res circle
  const paintCircle = (px: number, py: number, erase: boolean) => {
    const size = imgSize; const mask = maskBufRef.current;
    if (!size || !mask) return;
    const radiusFull = Math.max(1, Math.round((brushSize / 2) / scale));
    const w = size.w, h = size.h;
    const x0 = Math.max(0, px - radiusFull), x1 = Math.min(w - 1, px + radiusFull);
    const y0 = Math.max(0, py - radiusFull), y1 = Math.min(h - 1, py + radiusFull);
    const r2 = radiusFull * radiusFull;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - px, dy = y - py;
        if (dx * dx + dy * dy <= r2) mask[y * w + x] = erase ? 0 : 1;
      }
    }
  };

  // Pointer handlers on the interact layer
  const isDownRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const toFullCoords = (e: React.PointerEvent) => {
    const rect = interactRef.current!.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    const size = imgSize!;
    return { x: Math.floor(dx / displaySize.w * size.w), y: Math.floor(dy / displaySize.h * size.h) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgSize) return;
    interactRef.current!.setPointerCapture(e.pointerId);
    isDownRef.current = true;
    const { x, y } = toFullCoords(e);
    if (mode === "wand") { magicWand(x, y); return; }
    paintCircle(x, y, mode === "erase");
    lastPtRef.current = { x, y };
    repaintOverlay();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDownRef.current || mode === "wand" || !imgSize) return;
    const { x, y } = toFullCoords(e);
    // line-interpolate between last and current for continuous strokes
    const last = lastPtRef.current ?? { x, y };
    const steps = Math.max(1, Math.round(Math.hypot(x - last.x, y - last.y) / 2));
    for (let i = 1; i <= steps; i++) {
      const px = Math.round(last.x + (x - last.x) * (i / steps));
      const py = Math.round(last.y + (y - last.y) * (i / steps));
      paintCircle(px, py, mode === "erase");
    }
    lastPtRef.current = { x, y };
    repaintOverlay();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    isDownRef.current = false;
    lastPtRef.current = null;
    try { interactRef.current!.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const clearMask = () => {
    const m = maskBufRef.current; if (!m) return;
    m.fill(0); repaintOverlay();
  };

  const invertMask = () => {
    const m = maskBufRef.current; if (!m) return;
    for (let i = 0; i < m.length; i++) m[i] = m[i] ? 0 : 1;
    repaintOverlay();
  };

  const doExtract = () => {
    const size = imgSize; const data = pixelsRef.current; const mask = maskBufRef.current;
    if (!size || !data || !mask) return;
    if (!mask.some((v) => v > 0)) { alert("Mask is empty. Paint or wand-click something first."); return; }
    const w = size.w, h = size.h;
    const layerBuf = new Uint8ClampedArray(data.length);
    const cutBuf = cutFromSource ? new Uint8ClampedArray(data.length) : null;
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      if (mask[p]) {
        layerBuf[i] = data[i]; layerBuf[i + 1] = data[i + 1]; layerBuf[i + 2] = data[i + 2]; layerBuf[i + 3] = data[i + 3];
        // cut leaves these pixels transparent
      } else if (cutBuf) {
        cutBuf[i] = data[i]; cutBuf[i + 1] = data[i + 1]; cutBuf[i + 2] = data[i + 2]; cutBuf[i + 3] = data[i + 3];
      }
    }
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = w; layerCanvas.height = h;
    layerCanvas.getContext("2d")!.putImageData(new ImageData(layerBuf, w, h), 0, 0);
    const layerDataUrl = layerCanvas.toDataURL("image/png");

    let cutSourceDataUrl: string | undefined;
    if (cutBuf) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.putImageData(new ImageData(cutBuf, w, h), 0, 0);
      cutSourceDataUrl = c.toDataURL("image/png");
    }
    onExtract({ layerDataUrl, cutSourceDataUrl });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Mask &amp; extract
          </DialogTitle>
          <DialogDescription>
            Magic wand picks similar colors. Brush paints / erases manually. Click <strong>Extract</strong> to turn the red area into a new editable layer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="flex items-center justify-center rounded-md border border-border bg-[conic-gradient(at_top_left,_#e5e7eb_25%,_transparent_25%,_transparent_50%,_#e5e7eb_50%,_#e5e7eb_75%,_transparent_75%)] bg-[length:20px_20px] p-3">
            <div ref={interactRef}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              className="relative cursor-crosshair touch-none select-none"
              style={{ width: displaySize.w, height: displaySize.h }}
            >
              <canvas ref={baseCanvasRef} className="absolute inset-0" />
              <canvas ref={maskCanvasRef} className="pointer-events-none absolute inset-0" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tool</Label>
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" variant={mode === "wand" ? "default" : "outline"} onClick={() => setMode("wand")}>
                  <Sparkles className="h-3.5 w-3.5" /> Wand
                </Button>
                <Button size="sm" variant={mode === "brush" ? "default" : "outline"} onClick={() => setMode("brush")}>
                  <Brush className="h-3.5 w-3.5" /> Brush
                </Button>
                <Button size="sm" variant={mode === "erase" ? "default" : "outline"} onClick={() => setMode("erase")}>
                  <Eraser className="h-3.5 w-3.5" /> Erase
                </Button>
              </div>
            </div>

            {mode === "wand" && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-xs">Color tolerance</Label>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{tolerance}</span>
                  </div>
                  <Slider min={0} max={120} step={1} value={[tolerance]} onValueChange={(v) => setTolerance(v[0])} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Higher = picks more shades</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Contiguous only</Label>
                  <Switch checked={contiguous} onCheckedChange={setContiguous} />
                </div>
              </div>
            )}

            {(mode === "brush" || mode === "erase") && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs">Brush size</Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{brushSize}px</span>
                </div>
                <Slider min={4} max={200} step={2} value={[brushSize]} onValueChange={(v) => setBrushSize(v[0])} />
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cut selection from source</Label>
                <Switch checked={cutFromSource} onCheckedChange={setCutFromSource} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                On: original image keeps everything EXCEPT the mask. Off: original stays intact, a copy of the mask becomes a new layer on top.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" onClick={invertMask} disabled={!imgSize}>
                <MousePointer2 className="h-3.5 w-3.5" /> Invert
              </Button>
              <Button size="sm" variant="outline" onClick={clearMask} disabled={!imgSize}>
                Clear mask
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={doExtract} disabled={!hasMask}>
            <Wand2 className="h-4 w-4" /> Extract to new layer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
