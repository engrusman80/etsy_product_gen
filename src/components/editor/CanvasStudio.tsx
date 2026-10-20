import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignEndHorizontal, AlignEndVertical, AlignHorizontalJustifyCenter,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalJustifyCenter,
  ArrowDown, ArrowRight, ArrowUp, Circle as CircleIcon, Copy, Download, Eye, EyeOff,
  FlipHorizontal, FlipVertical, Group, Image as ImageIcon, Layers as LayersIcon, Loader2,
  Lock, MousePointer2, Pencil, Printer, Redo2, RotateCcw, Save, Slash, Sparkles,
  Square, Star, Trash2, Triangle as TriangleIcon, Type, Undo2, Ungroup, Unlock,
  Upload, Wand2, ZoomIn, ZoomOut,
} from "lucide-react";
import { splitImageByColor, type ColorLayer } from "@/lib/editor/color-split";
import { MaskExtractor } from "@/components/editor/MaskExtractor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FONTS, RTL_FAMILIES, ensureFont, injectFonts } from "@/lib/editor/fonts";

// We dynamically import fabric in useEffect so SSR never touches it.
type FabricMod = typeof import("fabric");
type FObject = import("fabric").FabricObject;
type FCanvas = import("fabric").Canvas;

type Tool = "select" | "text" | "rect" | "ellipse" | "triangle" | "star" | "arrow" | "line" | "draw";

type Props = {
  /** Optional initial image (data URL or http URL). If absent, blank canvas. */
  initialImage?: string;
  /** Title for the toolbar */
  title?: string;
  /** Called when the user clicks Apply; receives a PNG data URL. */
  onApply?: (dataUrl: string) => void;
  /** Initial canvas size; defaults to source image or 1080x1080. */
  defaultSize?: { w: number; h: number };
  /** If true and no initialImage is provided, auto-load a demo design. */
  demoOnEmpty?: boolean;
};

const CANVAS_PRESETS = [
  { label: "1:1 Square 4096 (4K)", w: 4096, h: 4096 },
  { label: "1:1 Square 2048", w: 2048, h: 2048 },
  { label: "4:5 Portrait 4096x5120", w: 4096, h: 5120 },
  { label: "9:16 Story 4096x7282", w: 4096, h: 7282 },
  { label: "16:9 Wide 4096x2304", w: 4096, h: 2304 },
  { label: "Etsy 4096x4096", w: 4096, h: 4096 },
];

// Print presets (target output in pixels at the given DPI)
// We render at the canvas's logical size and scale via `multiplier` so the
// exported pixels match the requested print spec exactly.
const PRINT_PRESETS = [
  { id: "letter-300", label: "US Letter 8.5×11\" — 300 DPI",  inW: 8.5, inH: 11,  dpi: 300 },
  { id: "a4-300",      label: "A4 8.27×11.69\" — 300 DPI",    inW: 8.27, inH: 11.69, dpi: 300 },
  { id: "sq12-300",    label: "Square 12×12\" — 300 DPI",     inW: 12,  inH: 12,  dpi: 300 },
  { id: "sq16-300",    label: "Square 16×16\" — 300 DPI",     inW: 16,  inH: 16,  dpi: 300 },
  { id: "poster18-300",label: "Poster 18×24\" — 300 DPI",     inW: 18,  inH: 24,  dpi: 300 },
  { id: "tshirt-300",  label: "T-Shirt print 12×16\" — 300 DPI", inW: 12, inH: 16, dpi: 300 },
];

export default function CanvasStudio({ initialImage, title = "Image Studio", onApply, defaultSize, demoOnEmpty }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricMod | null>(null);
  const canvasRef = useRef<FCanvas | null>(null);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<FObject | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);
  const [layers, setLayers] = useState<FObject[]>([]);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState(defaultSize ?? { w: 4096, h: 4096 });
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [showGrid, setShowGrid] = useState(false);
  const [snapGrid, setSnapGrid] = useState(false);
  const [gridSize, setGridSize] = useState(64);
  const [textDraft, setTextDraft] = useState("");
  void textDraft;
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);

  // Autosave & restore
  type Saved = { w: number; h: number; bg: string; json: unknown; ts: number };
  const [restoreState, setRestoreState] = useState<{ akey: string; savedAt: number; payload: Saved } | null>(null);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  // Print export dialog
  const [printOpen, setPrintOpen] = useState(false);
  const [printPreset, setPrintPreset] = useState<string>(PRINT_PRESETS[0].id);
  const [printFormat, setPrintFormat] = useState<"png" | "jpg" | "pdf">("pdf");
  const [printBleedMM, setPrintBleedMM] = useState<number>(3);
  const [printTransparent, setPrintTransparent] = useState<boolean>(false);
  const [printBusy, setPrintBusy] = useState(false);

  // Color-split state
  const [splitBusy, setSplitBusy] = useState(false);

  // Mask extractor state
  const [maskOpen, setMaskOpen] = useState(false);
  const [maskSrc, setMaskSrc] = useState<string | null>(null);
  const maskTargetRef = useRef<FObject | null>(null);

  const autosaveKey = (src?: string) => {
    if (!src) return "studio:autosave:blank";
    // hash the src to keep key short
    let h = 0;
    for (let i = 0; i < src.length; i++) h = ((h << 5) - h + src.charCodeAt(i)) | 0;
    return `studio:autosave:${h}`;
  };

  const loadImageOntoCanvas = async (c: FCanvas, fabric: FabricMod, url: string) => {
    try {
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      const cw = c.getWidth(), ch = c.getHeight();
      const scale = Math.min(cw / img.width!, ch / img.height!);
      img.scale(scale);
      img.set({
        left: (cw - img.width! * scale) / 2,
        top: (ch - img.height! * scale) / 2,
        selectable: true,
        name: "Background image",
      });
      c.add(img);
      c.sendObjectToBack(img);
      c.requestRenderAll();
    } catch (e) {
      console.error("Failed to load image", e);
    }
  };

  const loadDemoDesign = async (c: FCanvas, fabric: FabricMod, w: number, h: number) => {
    // Soft gradient background panel + sample text + shapes to test every tool.
    const bg = new fabric.Rect({
      left: 0, top: 0, width: w, height: h,
      fill: new fabric.Gradient({
        type: "linear",
        coords: { x1: 0, y1: 0, x2: w, y2: h },
        colorStops: [
          { offset: 0, color: "#fde68a" },
          { offset: 1, color: "#fca5a5" },
        ],
      }),
      selectable: false, evented: false,
    });
    (bg as unknown as { name?: string }).name = "Demo background";
    c.add(bg);


    const title = new fabric.IText("Hello, Studio ✨", {
      left: w * 0.1, top: h * 0.18,
      fontFamily: "Playfair Display", fontWeight: 900, fontSize: Math.round(w * 0.085),
      fill: "#0f172a",
    });
    (title as unknown as { name?: string }).name = "Demo title";
    const subtitle = new fabric.IText("Edit me, drag me, restyle me.\nPrint at 300 DPI when ready.", {
      left: w * 0.1, top: h * 0.32,
      fontFamily: "Inter", fontWeight: 500, fontSize: Math.round(w * 0.028),
      fill: "#1f2937", lineHeight: 1.3,
    });
    (subtitle as unknown as { name?: string }).name = "Demo subtitle";
    const star = new fabric.Polygon(starPoints(5, w * 0.08, w * 0.035), {
      left: w * 0.68, top: h * 0.55, fill: "#facc15",
      stroke: "#92400e", strokeWidth: 6,
    });
    (star as unknown as { name?: string }).name = "Demo star";
    const rect = new fabric.Rect({
      left: w * 0.1, top: h * 0.62, width: w * 0.32, height: h * 0.18,
      fill: "#0ea5e9", rx: 24, ry: 24,
    });
    (rect as unknown as { name?: string }).name = "Demo card";
    const cta = new fabric.IText("GET YOURS", {
      left: w * 0.13, top: h * 0.68,
      fontFamily: "Bebas Neue", fontSize: Math.round(w * 0.05),
      fill: "#ffffff", charSpacing: 60,
    });
    (cta as unknown as { name?: string }).name = "Demo CTA";
    c.add(title);
    c.add(subtitle);
    c.add(rect);
    c.add(cta);
    c.add(star);
    c.requestRenderAll();
  };

  // Revert to initial state (clears all edits)
  const revertToInitial = async () => {
    const c = canvasRef.current; const fabric = fabricRef.current; if (!c || !fabric) return;
    if (!confirm("Revert all edits and reload the original image?")) return;
    c.clear();
    c.backgroundColor = bgColor;
    if (initialImage) await loadImageOntoCanvas(c, fabric, initialImage);
    else if (demoOnEmpty) await loadDemoDesign(c, fabric, canvasSize.w, canvasSize.h);
    setLayers([...c.getObjects()]);
    rerender();
    snapshot();
  };

  const applySavedPayload = async (payload: Saved) => {
    const c = canvasRef.current; if (!c) return;
    setCanvasSize({ w: payload.w, h: payload.h });
    setBgColor(payload.bg);
    isRestoring.current = true;
    await c.loadFromJSON(payload.json as object);
    c.requestRenderAll();
    isRestoring.current = false;
    setLayers([...c.getObjects()]);
    snapshot();
    setRestoreState(null);
  };

  const dismissRestore = () => {
    if (restoreState) localStorage.removeItem(restoreState.akey);
    setRestoreState(null);
  };

  // History helpers
  const snapshot = () => {
    const c = canvasRef.current;
    if (!c || isRestoring.current) return;
    try {
      const json = JSON.stringify(c.toJSON());
      undoStack.current.push(json);
      if (undoStack.current.length > 60) undoStack.current.shift();
      redoStack.current = [];
    } catch { /* ignore */ }
  };

  const restore = async (json: string) => {
    const c = canvasRef.current;
    if (!c) return;
    isRestoring.current = true;
    await c.loadFromJSON(JSON.parse(json));
    c.requestRenderAll();
    isRestoring.current = false;
    setLayers([...c.getObjects()]);
    rerender();
  };

  // Boot Fabric
  useEffect(() => {
    let canceled = false;
    injectFonts();
    (async () => {
      const fabric = await import("fabric");
      if (canceled) return;
      fabricRef.current = fabric;
      const c = new fabric.Canvas(canvasElRef.current!, {
        backgroundColor: bgColor,
        preserveObjectStacking: true,
        selection: true,
        width: canvasSize.w,
        height: canvasSize.h,
        enableRetinaScaling: true,
      });
      canvasRef.current = c;

      // Wire events
      const sync = () => { setLayers([...c.getObjects()]); rerender(); };
      c.on("selection:created", (e) => { setSelected((e.selected?.[0] as FObject) ?? null); rerender(); });
      c.on("selection:updated", (e) => { setSelected((e.selected?.[0] as FObject) ?? null); rerender(); });
      c.on("selection:cleared", () => { setSelected(null); rerender(); });
      c.on("object:added", () => { sync(); snapshot(); });
      c.on("object:removed", () => { sync(); snapshot(); });
      c.on("object:modified", () => { sync(); snapshot(); });
      c.on("path:created", () => { sync(); snapshot(); });
      // Live updates while dragging / scaling / rotating so the properties panel reflects changes in real time
      c.on("object:moving", () => rerender());
      c.on("object:scaling", () => rerender());
      c.on("object:rotating", () => rerender());
      c.on("object:skewing", () => rerender());


      // Load initial image as background fit
      if (initialImage) {
        await loadImageOntoCanvas(c, fabric, initialImage);
      } else if (demoOnEmpty) {
        await loadDemoDesign(c, fabric, canvasSize.w, canvasSize.h);
      }

      // Try to restore an autosave for this source
      const akey = autosaveKey(initialImage);
      try {
        const raw = localStorage.getItem(akey);
        if (raw) {
          const saved = JSON.parse(raw) as { w: number; h: number; bg: string; json: unknown; ts: number };
          // Show restore banner (do NOT auto-apply — could overwrite a fresh edit)
          setRestoreState({ akey, savedAt: saved.ts, payload: saved });
        }
      } catch { /* ignore */ }

      snapshot();
      setReady(true);
    })();
    return () => { canceled = true; canvasRef.current?.dispose(); canvasRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply canvas size changes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.setDimensions({ width: canvasSize.w, height: canvasSize.h });
    fitToContainer();
    c.requestRenderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.w, canvasSize.h, ready]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.backgroundColor = bgColor;
    c.requestRenderAll();
  }, [bgColor]);

  // Tool switch wiring
  useEffect(() => {
    const c = canvasRef.current;
    const fabric = fabricRef.current;
    if (!c || !fabric) return;
    c.isDrawingMode = tool === "draw";
    if (tool === "draw") {
      const brush = new fabric.PencilBrush(c);
      brush.color = "#111111";
      brush.width = 4;
      c.freeDrawingBrush = brush;
    }
    c.defaultCursor = tool === "select" ? "default" : "crosshair";
  }, [tool, ready]);

  // Click-to-place creator tools
  useEffect(() => {
    const c = canvasRef.current;
    const fabric = fabricRef.current;
    if (!c || !fabric) return;
    if (tool === "select" || tool === "draw") return;

    const handler = (opt: { e: MouseEvent | TouchEvent }) => {
      const pt = c.getScenePoint(opt.e as MouseEvent);
      let obj: FObject | null = null;
      if (tool === "text") {
        obj = new fabric.IText("Double-click to edit", {
          left: pt.x, top: pt.y, fontFamily: "Inter", fontSize: 64, fontWeight: 600, fill: "#111111",
        });
      } else if (tool === "rect") {
        obj = new fabric.Rect({ left: pt.x, top: pt.y, width: 200, height: 140, fill: "#3b82f6", rx: 0, ry: 0 });
      } else if (tool === "ellipse") {
        obj = new fabric.Ellipse({ left: pt.x, top: pt.y, rx: 100, ry: 70, fill: "#ef4444" });
      } else if (tool === "triangle") {
        obj = new fabric.Triangle({ left: pt.x, top: pt.y, width: 200, height: 180, fill: "#10b981" });
      } else if (tool === "star") {
        const pts = starPoints(5, 100, 45);
        obj = new fabric.Polygon(pts, { left: pt.x, top: pt.y, fill: "#f59e0b" });
      } else if (tool === "arrow") {
        const pts = arrowPoints(240, 40);
        obj = new fabric.Polygon(pts, { left: pt.x, top: pt.y, fill: "#111111" });
      } else if (tool === "line") {
        obj = new fabric.Line([pt.x, pt.y, pt.x + 240, pt.y], { stroke: "#111111", strokeWidth: 6 });
      }
      if (obj) {
        c.add(obj);
        c.setActiveObject(obj);
        setTool("select");
      }
    };
    c.on("mouse:down", handler);
    return () => { c.off("mouse:down", handler); };
  }, [tool, ready]);

  // Fit canvas to container (visual zoom only — we use CSS transform via fabric setZoom)
  const fitToContainer = () => {
    const c = canvasRef.current;
    const wrap = containerRef.current;
    if (!c || !wrap) return;
    const pad = 32;
    const aw = wrap.clientWidth - pad;
    const ah = wrap.clientHeight - pad;
    const z = Math.min(aw / canvasSize.w, ah / canvasSize.h, 1);
    applyZoom(z);
  };

  const applyZoom = (z: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const nz = Math.max(0.05, Math.min(4, z));
    c.setZoom(nz);
    c.setDimensions({ width: canvasSize.w * nz, height: canvasSize.h * nz });
    setZoom(nz);
  };

  useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.w, canvasSize.h, ready]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const c = canvasRef.current;
      if (!c) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault(); duplicateSelected();
      }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (c.getActiveObject()) { e.preventDefault(); deleteSelected(); }
      }
      else if (e.key === "v") setTool("select");
      else if (e.key === "t") setTool("text");
      else if (e.key === "r") setTool("rect");
      else if (e.key === "o") setTool("ellipse");
      else if (e.key === "l") setTool("line");
      else if (e.key === "p") setTool("draw");
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault(); e.shiftKey ? ungroupSelected() : groupSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = async () => {
    if (undoStack.current.length < 2) return;
    const cur = undoStack.current.pop()!;
    redoStack.current.push(cur);
    const prev = undoStack.current[undoStack.current.length - 1];
    await restore(prev);
  };
  const redo = async () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(next);
    await restore(next);
  };

  const deleteSelected = () => {
    const c = canvasRef.current; if (!c) return;
    const objs = c.getActiveObjects();
    objs.forEach((o) => c.remove(o));
    c.discardActiveObject();
    c.requestRenderAll();
  };
  const duplicateSelected = async () => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject();
    if (!obj) return;
    const clone = await obj.clone();
    clone.set({ left: (obj.left ?? 0) + 24, top: (obj.top ?? 0) + 24 });
    c.add(clone);
    c.setActiveObject(clone);
    c.requestRenderAll();
  };
  const bringForward = () => {
    const c = canvasRef.current; const o = c?.getActiveObject(); if (!c || !o) return;
    c.bringObjectForward(o); c.requestRenderAll(); setLayers([...c.getObjects()]); snapshot();
  };
  const sendBackward = () => {
    const c = canvasRef.current; const o = c?.getActiveObject(); if (!c || !o) return;
    c.sendObjectBackwards(o); c.requestRenderAll(); setLayers([...c.getObjects()]); snapshot();
  };

  const onAddImageFile = async (file: File) => {
    const fabric = fabricRef.current; const c = canvasRef.current; if (!fabric || !c) return;
    const url = await fileToDataUrl(file);
    const img = await fabric.FabricImage.fromURL(url);
    const cw = c.getWidth() / c.getZoom();
    const scale = Math.min(1, (cw * 0.6) / img.width!);
    img.scale(scale);
    img.set({ left: 40, top: 40, name: file.name });
    c.add(img);
    c.setActiveObject(img);
    c.requestRenderAll();
  };

  // Export: render canvas at its real (logical) size, ignoring screen zoom
  const exportPng = (multiplier = 1): string => {
    const c = canvasRef.current; if (!c) return "";
    const prev = c.getZoom();
    c.setZoom(1);
    c.setDimensions({ width: canvasSize.w, height: canvasSize.h });
    const url = c.toDataURL({ format: "png", quality: 1, multiplier });
    c.setZoom(prev);
    c.setDimensions({ width: canvasSize.w * prev, height: canvasSize.h * prev });
    return url;
  };

  

  const handleApply = () => {
    const url = exportPng(1);
    onApply?.(url);
  };

  // ---- export to multiple formats ----------------------------------------
  const withLogicalSize = <T,>(fn: () => T): T => {
    const c = canvasRef.current!;
    const prev = c.getZoom();
    c.setZoom(1);
    c.setDimensions({ width: canvasSize.w, height: canvasSize.h });
    const out = fn();
    c.setZoom(prev);
    c.setDimensions({ width: canvasSize.w * prev, height: canvasSize.h * prev });
    return out;
  };

  const downloadDataUrl = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
  };

  const exportAs = async (kind: "png" | "jpg" | "webp" | "svg" | "pdf" | "psd-objects" | "psd-colors") => {
    const c = canvasRef.current; if (!c) return;
    if (kind === "svg") {
      const svg = withLogicalSize(() => c.toSVG());
      const blob = new Blob([svg], { type: "image/svg+xml" });
      downloadDataUrl(URL.createObjectURL(blob), "design.svg");
      return;
    }
    if (kind === "pdf") {
      const url = withLogicalSize(() => c.toDataURL({ format: "png", quality: 1, multiplier: 1 }));
      const { jsPDF } = await import("jspdf");
      const orient = canvasSize.w >= canvasSize.h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation: orient, unit: "px", format: [canvasSize.w, canvasSize.h] });
      pdf.addImage(url, "PNG", 0, 0, canvasSize.w, canvasSize.h);
      pdf.save("design.pdf");
      return;
    }
    if (kind === "psd-objects") {
      const { exportObjectsAsPsd } = await import("@/lib/editor/psd-export");
      await exportObjectsAsPsd({ canvas: c, width: canvasSize.w, height: canvasSize.h, backgroundColor: bgColor, filename: "design.psd" });
      return;
    }
    if (kind === "psd-colors") {
      const url = withLogicalSize(() => c.toDataURL({ format: "png", quality: 1, multiplier: 1 }));
      const { exportColorLayersAsPsd } = await import("@/lib/editor/psd-export");
      await exportColorLayersAsPsd({ imageDataUrl: url, k: 6, backgroundColor: bgColor, filename: "design-color-layers.psd" });
      return;
    }
    const fmt = kind === "jpg" ? "jpeg" : kind;
    const url = withLogicalSize(() => c.toDataURL({ format: fmt as "png" | "jpeg" | "webp", quality: 0.95, multiplier: 1 }));
    downloadDataUrl(url, `design.${kind}`);
  };

  const saveProject = () => {
    const c = canvasRef.current; if (!c) return;
    const proj = { v: 1, w: canvasSize.w, h: canvasSize.h, bg: bgColor, json: c.toJSON() };
    const blob = new Blob([JSON.stringify(proj)], { type: "application/json" });
    downloadDataUrl(URL.createObjectURL(blob), "design.studio.json");
  };

  const loadProjectFile = async (file: File) => {
    const c = canvasRef.current; if (!c) return;
    const text = await file.text();
    try {
      const proj = JSON.parse(text);
      if (proj.w && proj.h) setCanvasSize({ w: proj.w, h: proj.h });
      if (proj.bg) setBgColor(proj.bg);
      isRestoring.current = true;
      await c.loadFromJSON(proj.json);
      c.requestRenderAll();
      isRestoring.current = false;
      setLayers([...c.getObjects()]);
      snapshot();
    } catch (e) { console.error("Bad project file", e); }
  };

  // ---- print-ready export -------------------------------------------------
  // Renders at the requested pixel size for the chosen print spec, with optional
  // bleed (mm → px at the same DPI) and optional transparent background.
  const exportPrint = async () => {
    const c = canvasRef.current; if (!c) return;
    const preset = PRINT_PRESETS.find((p) => p.id === printPreset) ?? PRINT_PRESETS[0];
    setPrintBusy(true);
    try {
      const targetW = Math.round(preset.inW * preset.dpi);
      const targetH = Math.round(preset.inH * preset.dpi);
      const bleedPx = Math.round((printBleedMM / 25.4) * preset.dpi); // mm → in → px
      // Multiplier scales canvas logical pixels up to print pixels (fit, preserve aspect)
      const mult = Math.min(targetW / canvasSize.w, targetH / canvasSize.h);

      // Temporarily clear bg for transparent export
      const prevZoom = c.getZoom();
      const prevBg = c.backgroundColor;
      c.setZoom(1);
      c.setDimensions({ width: canvasSize.w, height: canvasSize.h });
      if (printTransparent) c.backgroundColor = "rgba(0,0,0,0)";
      c.renderAll();

      const fmt = printFormat === "pdf" ? "png" : (printFormat === "jpg" ? "jpeg" : "png");
      const dataUrl = c.toDataURL({
        format: fmt as "png" | "jpeg",
        quality: 0.98,
        multiplier: mult,
      });

      // Restore canvas state
      c.backgroundColor = prevBg;
      c.setZoom(prevZoom);
      c.setDimensions({ width: canvasSize.w * prevZoom, height: canvasSize.h * prevZoom });
      c.renderAll();

      // Compose onto print canvas with bleed margins
      const outW = targetW + bleedPx * 2;
      const outH = targetH + bleedPx * 2;
      const off = document.createElement("canvas");
      off.width = outW; off.height = outH;
      const ctx = off.getContext("2d")!;
      if (!printTransparent) {
        ctx.fillStyle = bgColor && bgColor !== "rgba(0,0,0,0)" ? bgColor : "#ffffff";
        ctx.fillRect(0, 0, outW, outH);
      }
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      // Center the design within the bleed
      const drawW = Math.round(canvasSize.w * mult);
      const drawH = Math.round(canvasSize.h * mult);
      ctx.drawImage(img, bleedPx + (targetW - drawW) / 2, bleedPx + (targetH - drawH) / 2, drawW, drawH);

      const fileBase = `print-${preset.id}${bleedPx ? `-bleed${printBleedMM}mm` : ""}`;

      if (printFormat === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: outW >= outH ? "landscape" : "portrait",
          unit: "in",
          format: [outW / preset.dpi, outH / preset.dpi],
          compress: true,
        });
        const png = off.toDataURL("image/png");
        pdf.addImage(png, "PNG", 0, 0, outW / preset.dpi, outH / preset.dpi, undefined, "FAST");
        pdf.save(`${fileBase}.pdf`);
      } else {
        const mime = printFormat === "jpg" ? "image/jpeg" : "image/png";
        const url = off.toDataURL(mime, 0.98);
        downloadDataUrl(url, `${fileBase}.${printFormat}`);
      }
      setPrintOpen(false);
    } finally {
      setPrintBusy(false);
    }
  };

  // ---- autosave -----------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const akey = autosaveKey(initialImage);
    const id = window.setInterval(() => {
      const c = canvasRef.current; if (!c) return;
      try {
        const payload = { w: canvasSize.w, h: canvasSize.h, bg: bgColor, json: c.toJSON(), ts: Date.now() };
        localStorage.setItem(akey, JSON.stringify(payload));
        setAutosavedAt(payload.ts);
      } catch { /* quota — ignore */ }
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialImage, canvasSize.w, canvasSize.h, bgColor]);


  // ---- transform helpers --------------------------------------------------
  const getActive = (): FObject | undefined => canvasRef.current?.getActiveObject() ?? undefined;

  const flipH = () => { const o = getActive(); if (!o) return; o.set("flipX", !o.flipX); canvasRef.current?.requestRenderAll(); rerender(); snapshot(); };
  const flipV = () => { const o = getActive(); if (!o) return; o.set("flipY", !o.flipY); canvasRef.current?.requestRenderAll(); rerender(); snapshot(); };

  const alignToCanvas = (where: "l" | "c" | "r" | "t" | "m" | "b") => {
    const c = canvasRef.current; const o = c?.getActiveObject() as (FObject & { width?: number; height?: number; scaleX?: number; scaleY?: number }) | undefined;
    if (!c || !o) return;
    const w = (o.width ?? 0) * (o.scaleX ?? 1);
    const h = (o.height ?? 0) * (o.scaleY ?? 1);
    if (where === "l") o.set("left", 0);
    if (where === "c") o.set("left", (canvasSize.w - w) / 2);
    if (where === "r") o.set("left", canvasSize.w - w);
    if (where === "t") o.set("top", 0);
    if (where === "m") o.set("top", (canvasSize.h - h) / 2);
    if (where === "b") o.set("top", canvasSize.h - h);
    o.setCoords();
    c.requestRenderAll(); rerender(); snapshot();
  };

  const groupSelected = () => {
    const fabric = fabricRef.current; const c = canvasRef.current; if (!fabric || !c) return;
    const active = c.getActiveObject() as unknown as { type?: string; getObjects?: () => FObject[] } | null;
    if (!active || active.type !== "activeselection") return;
    const objs = (active.getObjects?.() ?? []) as FObject[];
    const g = new fabric.Group(objs);
    objs.forEach((o) => c.remove(o));
    c.discardActiveObject();
    c.add(g);
    c.setActiveObject(g);
    c.requestRenderAll(); rerender(); snapshot();
  };
  const ungroupSelected = () => {
    const c = canvasRef.current; if (!c) return;
    const g = c.getActiveObject() as unknown as { type?: string; removeAll?: () => FObject[] } | null;
    if (!g || g.type !== "group" || !g.removeAll) return;
    const items = g.removeAll();
    c.remove(g as unknown as FObject);
    items.forEach((o) => c.add(o));
    c.discardActiveObject();
    c.requestRenderAll(); rerender(); snapshot();
  };

  // ---- drop shadow --------------------------------------------------------
  const setShadow = (opts: { color?: string; blur?: number; offX?: number; offY?: number; enabled?: boolean }) => {
    const fabric = fabricRef.current; const c = canvasRef.current; const o = c?.getActiveObject(); if (!fabric || !c || !o) return;
    const cur = (o as unknown as { shadow?: { color: string; blur: number; offsetX: number; offsetY: number } }).shadow ?? { color: "#000000", blur: 12, offsetX: 0, offsetY: 8 };
    const next = { ...cur, ...(opts.color !== undefined ? { color: opts.color } : {}), ...(opts.blur !== undefined ? { blur: opts.blur } : {}), ...(opts.offX !== undefined ? { offsetX: opts.offX } : {}), ...(opts.offY !== undefined ? { offsetY: opts.offY } : {}) };
    if (opts.enabled === false) { (o as unknown as { shadow: unknown }).shadow = null; }
    else { (o as unknown as { shadow: unknown }).shadow = new fabric.Shadow(next); }
    c.requestRenderAll(); rerender();
  };
  const getShadow = (): { color: string; blur: number; offsetX: number; offsetY: number; enabled: boolean } => {
    const o = selected as unknown as { shadow?: { color: string; blur: number; offsetX: number; offsetY: number } } | null;
    const s = o?.shadow;
    return { color: s?.color ?? "#000000", blur: s?.blur ?? 12, offsetX: s?.offsetX ?? 0, offsetY: s?.offsetY ?? 8, enabled: !!s };
  };

  // ---- background image ---------------------------------------------------
  const setBgImage = async (file: File) => {
    const fabric = fabricRef.current; const c = canvasRef.current; if (!fabric || !c) return;
    const url = await fileToDataUrl(file);
    const img = await fabric.FabricImage.fromURL(url);
    const scale = Math.max(canvasSize.w / img.width!, canvasSize.h / img.height!);
    img.scale(scale);
    img.set({ left: (canvasSize.w - img.width! * scale) / 2, top: (canvasSize.h - img.height! * scale) / 2, selectable: false, evented: false, name: "Background image" });
    c.add(img);
    c.sendObjectToBack(img);
    c.requestRenderAll(); rerender(); snapshot();
  };

  // ---- color-split: turn a flat image into N transparent color layers -----
  const splitTargetIntoLayers = async (k: number) => {
    const c = canvasRef.current; const fabric = fabricRef.current;
    if (!c || !fabric) return;

    // Pick target: selected image, else first FabricImage on the canvas.
    const objs = c.getObjects() as (FObject & { type?: string })[];
    let target: (FObject & { type?: string }) | null = null;
    if (selected && (selected as { type?: string }).type === "image") {
      target = selected as FObject & { type?: string };
    } else {
      target = objs.find((o) => o.type === "image") ?? null;
    }
    if (!target) { alert("No image found on canvas to split. Load or select an image first."); return; }

    // Resolve image source URL across fabric versions
    const t = target as unknown as {
      getSrc?: () => string;
      _element?: { src?: string; currentSrc?: string };
      left?: number; top?: number; scaleX?: number; scaleY?: number;
      angle?: number; flipX?: boolean; flipY?: boolean; originX?: string; originY?: string;
    };
    const src = (typeof t.getSrc === "function" ? t.getSrc() : undefined)
      ?? t._element?.currentSrc ?? t._element?.src;
    if (!src) { alert("Could not read the image pixels (cross-origin?)."); return; }

    setSplitBusy(true);
    try {
      const parts: ColorLayer[] = await splitImageByColor(src, { k });
      if (parts.length === 0) { alert("Split returned no layers."); return; }

      // Remove the original
      const transform = {
        left: t.left ?? 0, top: t.top ?? 0,
        scaleX: t.scaleX ?? 1, scaleY: t.scaleY ?? 1,
        angle: t.angle ?? 0, flipX: !!t.flipX, flipY: !!t.flipY,
        originX: t.originX ?? "left", originY: t.originY ?? "top",
      };
      c.remove(target);

      // Add a new FabricImage per cluster with identical transform.
      for (const part of parts) {
        const img = await fabric.FabricImage.fromURL(part.dataUrl, { crossOrigin: "anonymous" });
        img.set({
          left: transform.left, top: transform.top,
          scaleX: transform.scaleX, scaleY: transform.scaleY,
          angle: transform.angle, flipX: transform.flipX, flipY: transform.flipY,
          originX: transform.originX, originY: transform.originY,
          selectable: true, evented: true,
        });
        (img as unknown as { name?: string }).name =
          `Color ${part.color} · ${Math.round(part.coverage * 100)}%`;
        c.add(img);
      }
      c.requestRenderAll();
      setLayers([...c.getObjects()]);
      rerender();
      snapshot();
    } catch (e) {
      console.error(e);
      alert("Failed to split image. If this is a remote URL, it may be blocked by CORS.");
    } finally {
      setSplitBusy(false);
    }
  };

  // ---- mask extractor: open dialog for the selected/first image ----------
  const openMaskTool = () => {
    const c = canvasRef.current; if (!c) return;
    const objs = c.getObjects() as (FObject & { type?: string })[];
    let target: (FObject & { type?: string }) | null = null;
    if (selected && (selected as { type?: string }).type === "image") {
      target = selected as FObject & { type?: string };
    } else {
      target = objs.find((o) => o.type === "image") ?? null;
    }
    if (!target) { alert("Select an image layer first, or load one onto the canvas."); return; }
    const t = target as unknown as { getSrc?: () => string; _element?: { src?: string; currentSrc?: string } };
    const src = (typeof t.getSrc === "function" ? t.getSrc() : undefined)
      ?? t._element?.currentSrc ?? t._element?.src;
    if (!src) { alert("Could not read the image pixels (cross-origin?)."); return; }
    maskTargetRef.current = target;
    setMaskSrc(src);
    setMaskOpen(true);
  };

  const handleMaskExtracted = async ({ layerDataUrl, cutSourceDataUrl }: { layerDataUrl: string; cutSourceDataUrl?: string }) => {
    const c = canvasRef.current; const fabric = fabricRef.current; const target = maskTargetRef.current;
    if (!c || !fabric || !target) return;
    const t = target as unknown as {
      left?: number; top?: number; scaleX?: number; scaleY?: number;
      angle?: number; flipX?: boolean; flipY?: boolean; originX?: string; originY?: string;
    };
    const transform = {
      left: t.left ?? 0, top: t.top ?? 0,
      scaleX: t.scaleX ?? 1, scaleY: t.scaleY ?? 1,
      angle: t.angle ?? 0, flipX: !!t.flipX, flipY: !!t.flipY,
      originX: t.originX ?? "left", originY: t.originY ?? "top",
    };

    // Optionally replace the source image with the "cut" version
    if (cutSourceDataUrl) {
      c.remove(target);
      const cutImg = await fabric.FabricImage.fromURL(cutSourceDataUrl, { crossOrigin: "anonymous" });
      cutImg.set({ ...transform, selectable: true, evented: true });
      (cutImg as unknown as { name?: string }).name =
        ((target as unknown as { name?: string }).name ?? "Source") + " (masked)";
      c.add(cutImg);
      c.sendObjectToBack(cutImg);
    }

    const layerImg = await fabric.FabricImage.fromURL(layerDataUrl, { crossOrigin: "anonymous" });
    layerImg.set({ ...transform, selectable: true, evented: true });
    (layerImg as unknown as { name?: string }).name = `Masked layer ${Date.now().toString().slice(-4)}`;
    c.add(layerImg);
    c.setActiveObject(layerImg);
    c.requestRenderAll();
    setSelected(layerImg);
    setLayers([...c.getObjects()]);
    rerender();
    snapshot();
    maskTargetRef.current = null;
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const onMove = (e: { target?: FObject | null }) => {
      if (!snapGrid || !e.target) return;
      const t = e.target as FObject & { left?: number; top?: number };
      t.left = Math.round((t.left ?? 0) / gridSize) * gridSize;
      t.top = Math.round((t.top ?? 0) / gridSize) * gridSize;
      t.setCoords();
    };
    c.on("object:moving", onMove);
    return () => { c.off("object:moving", onMove); };
  }, [snapGrid, gridSize, ready]);




  // ---- selection helpers (typed-ish) -------------------------------------
  type AnyObj = FObject & {
    type?: string;
    set: (k: string | object, v?: unknown) => void;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    angle?: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    underline?: boolean;
    textAlign?: string;
    direction?: string;
    text?: string;
    name?: string;
  };
  const sel = selected as AnyObj | null;
  const isText = sel && (sel.type === "i-text" || sel.type === "textbox" || sel.type === "text");
  const isImage = sel && sel.type === "image";

  const setProp = (k: string, v: unknown) => {
    const c = canvasRef.current; const o = c?.getActiveObject() as AnyObj | undefined;
    if (!c || !o) return;
    o.set(k, v);
    c.requestRenderAll();
    rerender();
  };

  const setFont = async (family: string) => {
    await ensureFont(family);
    setProp("fontFamily", family);
    if (RTL_FAMILIES.has(family)) {
      setProp("direction", "rtl");
      setProp("textAlign", "right");
    }
  };

  // ---- image filters (live) -----------------------------------------------
  type ImgFilters = {
    brightness: number; contrast: number; saturation: number; hue: number;
    blur: number; grayscale: boolean; sepia: boolean; invert: boolean;
    tintColor: string; tintOpacity: number;
  };
  const DEFAULT_FILTERS: ImgFilters = {
    brightness: 0, contrast: 0, saturation: 0, hue: 0,
    blur: 0, grayscale: false, sepia: false, invert: false,
    tintColor: "", tintOpacity: 0.5,
  };
  const getImgFilters = (): ImgFilters => {
    const o = sel as unknown as { _studioFilters?: ImgFilters } | null;
    return { ...DEFAULT_FILTERS, ...(o?._studioFilters ?? {}) };
  };
  const applyImgFilters = (next: Partial<ImgFilters>) => {
    const fabric = fabricRef.current;
    const c = canvasRef.current;
    const o = c?.getActiveObject() as (AnyObj & { filters?: unknown[]; applyFilters?: () => void; _studioFilters?: ImgFilters }) | undefined;
    if (!fabric || !c || !o || o.type !== "image") return;
    const cur: ImgFilters = { ...DEFAULT_FILTERS, ...(o._studioFilters ?? {}), ...next };
    o._studioFilters = cur;
    const F = fabric.filters as Record<string, new (opts?: Record<string, unknown>) => unknown>;
    const list: unknown[] = [];
    if (cur.brightness) list.push(new F.Brightness({ brightness: cur.brightness }));
    if (cur.contrast) list.push(new F.Contrast({ contrast: cur.contrast }));
    if (cur.saturation) list.push(new F.Saturation({ saturation: cur.saturation }));
    if (cur.hue) list.push(new F.HueRotation({ rotation: cur.hue }));
    if (cur.blur) list.push(new F.Blur({ blur: cur.blur }));
    if (cur.grayscale) list.push(new F.Grayscale());
    if (cur.sepia) list.push(new F.Sepia());
    if (cur.invert) list.push(new F.Invert());
    if (cur.tintColor) {
      // BlendColor multiply with the chosen color, intensity = tintOpacity
      list.push(new F.BlendColor({ color: cur.tintColor, mode: "tint", alpha: cur.tintOpacity }));
    }
    o.filters = list;
    o.applyFilters?.();
    c.requestRenderAll();
    rerender();
  };
  const resetImgFilters = () => {
    const c = canvasRef.current;
    const o = c?.getActiveObject() as (AnyObj & { filters?: unknown[]; applyFilters?: () => void; _studioFilters?: ImgFilters }) | undefined;
    if (!c || !o) return;
    o._studioFilters = { ...DEFAULT_FILTERS };
    o.filters = [];
    o.applyFilters?.();
    c.requestRenderAll();
    rerender();
  };



  // ---- render -------------------------------------------------------------
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen flex-col bg-muted/30 text-foreground">
        {/* Top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-3">
          <div className="mr-2 text-sm font-semibold">{title}</div>
          <ToolbarBtn label="Undo (⌘Z)" onClick={undo}><Undo2 className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn label="Redo (⌘⇧Z)" onClick={redo}><Redo2 className="h-4 w-4" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn label="Zoom out" onClick={() => applyZoom(zoom * 0.8)}><ZoomOut className="h-4 w-4" /></ToolbarBtn>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <ToolbarBtn label="Zoom in" onClick={() => applyZoom(zoom * 1.25)}><ZoomIn className="h-4 w-4" /></ToolbarBtn>
          <Button size="sm" variant="ghost" className="h-8" onClick={fitToContainer}>Fit</Button>
          <Divider />
          <Select
            value={`${canvasSize.w}x${canvasSize.h}`}
            onValueChange={(v) => {
              const p = CANVAS_PRESETS.find((x) => `${x.w}x${x.h}` === v);
              if (p) setCanvasSize({ w: p.w, h: p.h });
            }}
          >
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Canvas size" /></SelectTrigger>
            <SelectContent>
              {CANVAS_PRESETS.map((p) => (
                <SelectItem key={p.label} value={`${p.w}x${p.h}`}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            {autosavedAt && (
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                Autosaved {new Date(autosavedAt).toLocaleTimeString()}
              </span>
            )}
            <ToolbarBtn label="Load demo design" onClick={async () => {
              const c = canvasRef.current; const fabric = fabricRef.current; if (!c || !fabric) return;
              await loadDemoDesign(c, fabric, canvasSize.w, canvasSize.h);
              setLayers([...c.getObjects()]); rerender(); snapshot();
            }}><Sparkles className="h-4 w-4" /></ToolbarBtn>
            <ToolbarBtn label="Revert to original" onClick={revertToInitial}>
              <RotateCcw className="h-4 w-4" />
            </ToolbarBtn>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={splitBusy} title="Split image into editable color layers">
                  {splitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayersIcon className="h-4 w-4" />}
                  Split layers
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Break the image into separate color layers — each one becomes draggable & deletable like in Canva.
                </div>
                <DropdownMenuSeparator />
                {[4, 6, 8, 10, 12].map((k) => (
                  <DropdownMenuItem key={k} onClick={() => splitTargetIntoLayers(k)}>
                    {k} color layers
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={openMaskTool} title="Magic wand / brush mask → new layer">
              <Wand2 className="h-4 w-4" /> Mask
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => exportAs("png")}>PNG — lossless</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs("jpg")}>JPEG — small file</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs("webp")}>WebP — modern web</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs("svg")}>SVG — vector</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs("pdf")}>PDF — print-ready</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportAs("psd-objects")}>PSD — object layers (Photoshop)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs("psd-colors")}>PSD — color layers (Photoshop)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPrintOpen(true)}>
                  <Printer className="mr-2 inline h-3.5 w-3.5" /> Print presets (300 DPI)…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={saveProject}>Save project (.json)</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer">
                    <Upload className="mr-2 inline h-3.5 w-3.5" /> Load project…
                    <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) loadProjectFile(f); e.currentTarget.value = "";
                    }} />
                  </label>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onApply && (
              <Button size="sm" onClick={handleApply}>
                <Save className="h-4 w-4" /> Apply
              </Button>
            )}
          </div>
        </div>

        {/* Restore banner */}
        {restoreState && (
          <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <span>
              Found an autosave from {new Date(restoreState.savedAt).toLocaleString()}. Restore it?
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => applySavedPayload(restoreState.payload)}>
                Restore
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={dismissRestore}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Mask extractor */}
        {maskSrc && (
          <MaskExtractor open={maskOpen} onOpenChange={setMaskOpen} src={maskSrc} onExtract={handleMaskExtracted} />
        )}

        {/* Print export dialog */}
        {printOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !printBusy && setPrintOpen(false)}>
            <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 text-base font-semibold">Print-ready export</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Rendered at 300 DPI. Optional bleed and transparent background for pro printing.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Print size</Label>
                  <Select value={printPreset} onValueChange={setPrintPreset}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRINT_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Format</Label>
                  <Select value={printFormat} onValueChange={(v) => setPrintFormat(v as "png" | "jpg" | "pdf")}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF (best for print shops)</SelectItem>
                      <SelectItem value="png">PNG (lossless, supports transparency)</SelectItem>
                      <SelectItem value="jpg">JPG (small file, no transparency)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-xs">Bleed (mm)</Label>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{printBleedMM} mm</span>
                  </div>
                  <Slider min={0} max={10} step={1} value={[printBleedMM]} onValueChange={(v) => setPrintBleedMM(v[0])} />
                  <p className="mt-1 text-[10px] text-muted-foreground">3 mm is standard for most print shops.</p>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <Label className="text-xs">Transparent background</Label>
                    <p className="text-[10px] text-muted-foreground">PNG only — JPG will use white.</p>
                  </div>
                  <Switch checked={printTransparent} onCheckedChange={setPrintTransparent} />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPrintOpen(false)} disabled={printBusy}>Cancel</Button>
                <Button size="sm" onClick={exportPrint} disabled={printBusy}>
                  {printBusy ? "Rendering…" : "Export"}
                </Button>
              </div>
            </div>
          </div>
        )}



        <div className="flex flex-1 overflow-hidden">
          {/* Left tools */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-2">
            <ToolBtn active={tool === "select"} label="Select (V)" onClick={() => setTool("select")}><MousePointer2 className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "text"} label="Text (T)" onClick={() => setTool("text")}><Type className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "rect"} label="Rectangle (R)" onClick={() => setTool("rect")}><Square className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "ellipse"} label="Ellipse (O)" onClick={() => setTool("ellipse")}><CircleIcon className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "triangle"} label="Triangle" onClick={() => setTool("triangle")}><TriangleIcon className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "star"} label="Star" onClick={() => setTool("star")}><Star className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "arrow"} label="Arrow" onClick={() => setTool("arrow")}><ArrowRight className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "line"} label="Line (L)" onClick={() => setTool("line")}><Slash className="h-5 w-5" /></ToolBtn>
            <ToolBtn active={tool === "draw"} label="Pen — free draw (P)" onClick={() => setTool("draw")}><Pencil className="h-5 w-5" /></ToolBtn>
            <label className="mt-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Insert image">
              <ImageIcon className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) onAddImageFile(f); e.currentTarget.value = "";
              }} />
            </label>
            <div className="mt-auto mb-1 flex flex-col items-center gap-1">
              <ToolBtn label="Duplicate (⌘D)" onClick={duplicateSelected}><Copy className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Delete (Del)" onClick={deleteSelected}><Trash2 className="h-4 w-4" /></ToolBtn>
            </div>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_1px_1px,#0001_1px,transparent_0)] [background-size:12px_12px] p-4">
            <div className="relative shadow-lg ring-1 ring-border" style={{ background: bgColor }}>
              <canvas ref={canvasElRef} />
              {showGrid && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="studio-grid" width={gridSize * zoom} height={gridSize * zoom} patternUnits="userSpaceOnUse">
                      <path d={`M ${gridSize * zoom} 0 L 0 0 0 ${gridSize * zoom}`} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#studio-grid)" />
                </svg>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-background">
            <Tabs defaultValue="props" className="w-full">
              <TabsList className="m-2 grid w-[calc(100%-1rem)] grid-cols-3">
                <TabsTrigger value="props">Properties</TabsTrigger>
                <TabsTrigger value="layers">Layers</TabsTrigger>
                <TabsTrigger value="bg">Canvas</TabsTrigger>
              </TabsList>

              <TabsContent value="props" className="space-y-4 p-3">
                {!sel && <p className="text-xs text-muted-foreground">Select an element to edit its properties.</p>}
                {sel && (
                  <>
                    <Section title="Transform">
                      <Row2>
                        <NumberField label="X" value={Math.round(sel.left ?? 0)} onChange={(v) => setProp("left", v)} />
                        <NumberField label="Y" value={Math.round(sel.top ?? 0)} onChange={(v) => setProp("top", v)} />
                      </Row2>
                      <Row2>
                        <NumberField label="Rotation°" value={Math.round(sel.angle ?? 0)} onChange={(v) => setProp("angle", v)} />
                        <div>
                          <Label className="text-xs">Opacity</Label>
                          <Slider min={0} max={100} step={1} value={[Math.round((sel.opacity ?? 1) * 100)]}
                            onValueChange={(v) => setProp("opacity", v[0] / 100)} />
                        </div>
                      </Row2>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={bringForward}><ArrowUp className="h-3.5 w-3.5" /> Forward</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={sendBackward}><ArrowDown className="h-3.5 w-3.5" /> Backward</Button>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={flipH}><FlipHorizontal className="h-3.5 w-3.5" /> Flip H</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={flipV}><FlipVertical className="h-3.5 w-3.5" /> Flip V</Button>
                      </div>
                      <div>
                        <Label className="text-xs">Align to canvas</Label>
                        <div className="mt-1 grid grid-cols-6 gap-1">
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("l")}><AlignStartVertical className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Left</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("c")}><AlignHorizontalJustifyCenter className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Center H</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("r")}><AlignEndVertical className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Right</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("t")}><AlignStartHorizontal className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Top</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("m")}><AlignVerticalJustifyCenter className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Middle V</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" className="h-7 px-0" onClick={() => alignToCanvas("b")}><AlignEndHorizontal className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Bottom</TooltipContent></Tooltip>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={groupSelected}><Group className="h-3.5 w-3.5" /> Group</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={ungroupSelected}><Ungroup className="h-3.5 w-3.5" /> Ungroup</Button>
                      </div>
                    </Section>

                    <Section title="Drop shadow">
                      {(() => {
                        const s = getShadow();
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Enable shadow</Label>
                              <Switch checked={s.enabled} onCheckedChange={(v) => setShadow({ enabled: v, color: s.color, blur: s.blur, offX: s.offsetX, offY: s.offsetY })} />
                            </div>
                            {s.enabled && (
                              <>
                                <ColorField label="Color" value={s.color} onChange={(v) => setShadow({ color: v })} />
                                <FilterSlider label="Blur" value={s.blur} min={0} max={80} step={1} onChange={(v) => setShadow({ blur: v })} />
                                <Row2>
                                  <NumberField label="Offset X" value={s.offsetX} onChange={(v) => setShadow({ offX: v })} />
                                  <NumberField label="Offset Y" value={s.offsetY} onChange={(v) => setShadow({ offY: v })} />
                                </Row2>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </Section>


                    {!isText && !isImage && (
                      <Section title="Appearance">
                        <ColorField label="Fill" value={(sel.fill as string) || ""} onChange={(v) => setProp("fill", v)} />
                        <ColorField label="Stroke" value={(sel.stroke as string) || ""} onChange={(v) => setProp("stroke", v)} />
                        <div>
                          <Label className="text-xs">Stroke width</Label>
                          <Slider min={0} max={40} step={1} value={[sel.strokeWidth ?? 0]}
                            onValueChange={(v) => setProp("strokeWidth", v[0])} />
                        </div>
                      </Section>
                    )}

                    {isImage && (() => {
                      const f = getImgFilters();
                      return (
                        <Section title="Image filters">
                          <FilterSlider label="Brightness" value={f.brightness} min={-1} max={1} step={0.01}
                            onChange={(v) => applyImgFilters({ brightness: v })} />
                          <FilterSlider label="Contrast" value={f.contrast} min={-1} max={1} step={0.01}
                            onChange={(v) => applyImgFilters({ contrast: v })} />
                          <FilterSlider label="Saturation" value={f.saturation} min={-1} max={1} step={0.01}
                            onChange={(v) => applyImgFilters({ saturation: v })} />
                          <FilterSlider label="Hue" value={f.hue} min={-1} max={1} step={0.01}
                            onChange={(v) => applyImgFilters({ hue: v })} />
                          <FilterSlider label="Blur" value={f.blur} min={0} max={1} step={0.01}
                            onChange={(v) => applyImgFilters({ blur: v })} />
                          <div className="grid grid-cols-3 gap-1">
                            <Button size="sm" variant={f.grayscale ? "default" : "outline"} className="h-7 text-xs"
                              onClick={() => applyImgFilters({ grayscale: !f.grayscale })}>B&amp;W</Button>
                            <Button size="sm" variant={f.sepia ? "default" : "outline"} className="h-7 text-xs"
                              onClick={() => applyImgFilters({ sepia: !f.sepia })}>Sepia</Button>
                            <Button size="sm" variant={f.invert ? "default" : "outline"} className="h-7 text-xs"
                              onClick={() => applyImgFilters({ invert: !f.invert })}>Invert</Button>
                          </div>
                          <div>
                            <Label className="text-xs">Tint color</Label>
                            <div className="mt-1 flex gap-1">
                              <input type="color" value={toHexInput(f.tintColor || "#3b82f6")}
                                onChange={(e) => applyImgFilters({ tintColor: e.target.value })}
                                className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background" />
                              <Input value={f.tintColor} placeholder="none"
                                onChange={(e) => applyImgFilters({ tintColor: e.target.value })}
                                className="h-8 text-xs" />
                              {f.tintColor && (
                                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs"
                                  onClick={() => applyImgFilters({ tintColor: "" })}>×</Button>
                              )}
                            </div>
                          </div>
                          {f.tintColor && (
                            <FilterSlider label="Tint strength" value={f.tintOpacity} min={0} max={1} step={0.01}
                              onChange={(v) => applyImgFilters({ tintOpacity: v })} />
                          )}
                          <Button size="sm" variant="outline" className="w-full" onClick={resetImgFilters}>Reset filters</Button>
                          <ColorField label="Border" value={(sel.stroke as string) || ""} onChange={(v) => setProp("stroke", v)} />
                          <div>
                            <Label className="text-xs">Border width</Label>
                            <Slider min={0} max={40} step={1} value={[sel.strokeWidth ?? 0]}
                              onValueChange={(v) => setProp("strokeWidth", v[0])} />
                          </div>
                        </Section>
                      );
                    })()}



                    {isText && (
                      <Section title="Text">
                        <div>
                          <Label className="text-xs">Content</Label>
                          <Textarea rows={2} value={sel.text ?? ""} onChange={(e) => setProp("text", e.target.value)} dir={sel.direction === "rtl" ? "rtl" : "ltr"} />
                        </div>
                        <div>
                          <Label className="text-xs">Font family</Label>
                          <Select value={(sel.fontFamily as string) || "Inter"} onValueChange={setFont}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-[60vh]">
                              {(["Sans", "Serif", "Display", "Script", "Mono", "CJK", "Indic", "Arabic", "Urdu"] as const).map((g) => {
                                const items = FONTS.filter((f) => f.group === g);
                                if (!items.length) return null;
                                return (
                                  <SelectGroup key={g}>
                                    <SelectLabel>{g}</SelectLabel>
                                    {items.map((f) => (
                                      <SelectItem key={f.family} value={f.family}>
                                        <span style={{ fontFamily: `"${f.family}"` }}>{f.family}</span>
                                        {f.langs && <span className="ml-2 text-muted-foreground">{f.langs}</span>}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <Row2>
                          <NumberField label="Size" value={Math.round(sel.fontSize ?? 24)} onChange={(v) => setProp("fontSize", v)} />
                          <div>
                            <Label className="text-xs">Weight</Label>
                            <Select value={String(sel.fontWeight ?? 400)} onValueChange={(v) => setProp("fontWeight", isNaN(+v) ? v : +v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[300, 400, 500, 600, 700, 800, 900].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </Row2>
                        <Row2>
                          <div>
                            <Label className="text-xs">Style</Label>
                            <div className="mt-1 flex gap-1">
                              <Button size="sm" variant={sel.fontStyle === "italic" ? "default" : "outline"} className="h-7 flex-1 text-xs"
                                onClick={() => setProp("fontStyle", sel.fontStyle === "italic" ? "normal" : "italic")}><em>I</em></Button>
                              <Button size="sm" variant={sel.underline ? "default" : "outline"} className="h-7 flex-1 text-xs"
                                onClick={() => setProp("underline", !sel.underline)}><u>U</u></Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Align</Label>
                            <Select value={(sel.textAlign as string) || "left"} onValueChange={(v) => setProp("textAlign", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["left", "center", "right", "justify"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </Row2>
                        <div className="flex items-center justify-between rounded-md border border-border p-2">
                          <div>
                            <Label className="text-xs">RTL (Arabic, Urdu, Hebrew)</Label>
                            <p className="text-[10px] text-muted-foreground">Right-to-left text flow</p>
                          </div>
                          <Switch checked={sel.direction === "rtl"} onCheckedChange={(v) => { setProp("direction", v ? "rtl" : "ltr"); if (v) setProp("textAlign", "right"); }} />
                        </div>
                        <ColorField label="Color" value={(sel.fill as string) || "#000000"} onChange={(v) => setProp("fill", v)} />
                        <Row2>
                          <div>
                            <Label className="text-xs">Letter spacing</Label>
                            <Slider min={-200} max={1200} step={10} value={[(sel as unknown as { charSpacing?: number }).charSpacing ?? 0]}
                              onValueChange={(v) => setProp("charSpacing", v[0])} />
                          </div>
                          <div>
                            <Label className="text-xs">Line height</Label>
                            <Slider min={0.5} max={3} step={0.05} value={[(sel as unknown as { lineHeight?: number }).lineHeight ?? 1.16]}
                              onValueChange={(v) => setProp("lineHeight", v[0])} />
                          </div>
                        </Row2>
                        <ColorField label="Stroke color" value={(sel.stroke as string) || ""} onChange={(v) => setProp("stroke", v)} />
                        <div>
                          <Label className="text-xs">Stroke width</Label>
                          <Slider min={0} max={20} step={0.5} value={[sel.strokeWidth ?? 0]}
                            onValueChange={(v) => setProp("strokeWidth", v[0])} />
                        </div>
                      </Section>

                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="layers" className="space-y-1 p-3">
                {layers.length === 0 && <p className="text-xs text-muted-foreground">No layers yet.</p>}
                {[...layers].reverse().map((o, displayIdx) => {
                  const realIdx = layers.length - 1 - displayIdx;
                  return (
                    <LayerRow
                      key={realIdx}
                      obj={o as AnyObj}
                      active={selected === o}
                      canMoveUp={realIdx < layers.length - 1}
                      canMoveDown={realIdx > 0}
                      onPick={() => { canvasRef.current?.setActiveObject(o); canvasRef.current?.requestRenderAll(); setSelected(o); rerender(); }}
                      onToggleVisible={() => { (o as AnyObj).set("visible", !((o as AnyObj) as unknown as { visible?: boolean }).visible); canvasRef.current?.requestRenderAll(); rerender(); }}
                      onToggleLock={() => {
                        const oa = o as AnyObj as unknown as { selectable?: boolean; evented?: boolean };
                        const lock = oa.selectable !== false;
                        (o as AnyObj).set("selectable", !lock);
                        (o as AnyObj).set("evented", !lock);
                        canvasRef.current?.requestRenderAll(); rerender();
                      }}
                      onDelete={() => { canvasRef.current?.remove(o); canvasRef.current?.requestRenderAll(); setLayers([...(canvasRef.current?.getObjects() ?? [])]); snapshot(); }}
                      onMoveUp={() => { canvasRef.current?.bringObjectForward(o); canvasRef.current?.requestRenderAll(); setLayers([...(canvasRef.current?.getObjects() ?? [])]); snapshot(); }}
                      onMoveDown={() => { canvasRef.current?.sendObjectBackwards(o); canvasRef.current?.requestRenderAll(); setLayers([...(canvasRef.current?.getObjects() ?? [])]); snapshot(); }}
                      onRename={(newName) => { (o as AnyObj).set("name", newName); rerender(); snapshot(); }}
                    />
                  );
                })}
              </TabsContent>

              <TabsContent value="bg" className="space-y-4 p-3">
                <Section title="Background">
                  <ColorField label="Color" value={bgColor} onChange={setBgColor} />
                  <Button size="sm" variant="outline" onClick={() => setBgColor("rgba(0,0,0,0)")}>Make transparent</Button>
                  <label className="mt-1 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Upload className="h-3.5 w-3.5" /> Upload background image…
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) setBgImage(f); e.currentTarget.value = "";
                    }} />
                  </label>
                </Section>
                <Section title="Canvas size">
                  <Row2>
                    <NumberField label="Width" value={canvasSize.w} onChange={(v) => setCanvasSize((s) => ({ ...s, w: Math.max(64, v) }))} />
                    <NumberField label="Height" value={canvasSize.h} onChange={(v) => setCanvasSize((s) => ({ ...s, h: Math.max(64, v) }))} />
                  </Row2>
                </Section>
                <Section title="Grid">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show grid overlay</Label>
                    <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Snap to grid</Label>
                    <Switch checked={snapGrid} onCheckedChange={setSnapGrid} />
                  </div>
                  <NumberField label="Grid size (px)" value={gridSize} onChange={(v) => setGridSize(Math.max(4, v))} />
                </Section>
              </TabsContent>

            </Tabs>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex h-7 items-center justify-between border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
          <span>{canvasSize.w} × {canvasSize.h} px</span>
          <span>Tool: <strong className="text-foreground">{tool}</strong></span>
          <span>{layers.length} layer{layers.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ----- bits ----- */
function ToolBtn({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
function ToolbarBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onClick}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
function Divider() { return <div className="mx-1 h-6 w-px bg-border" />; }
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" className="mt-1 h-8 text-xs" value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); }} />
    </div>
  );
}
function FilterSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-[10px] tabular-nums text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-1">
        <input type="color" value={toHexInput(value)} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background" />
        <Input value={value} placeholder="#ffffff or rgba(…)" onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
        {value && <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange("")}>×</Button>}
      </div>
    </div>
  );
}
function LayerRow({ obj, active, canMoveUp, canMoveDown, onPick, onToggleVisible, onToggleLock, onDelete, onMoveUp, onMoveDown, onRename }: {
  obj: { type?: string; name?: string; visible?: boolean; selectable?: boolean; text?: string };
  active: boolean; canMoveUp: boolean; canMoveDown: boolean;
  onPick: () => void; onToggleVisible: () => void; onToggleLock: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onRename: (n: string) => void;
}) {
  const fallback = obj.name ?? obj.text?.slice(0, 28) ?? obj.type ?? "object";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fallback);
  return (
    <div className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${active ? "border-primary bg-accent" : "border-border"}`}>
      {editing ? (
        <Input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft.trim()) onRename(draft.trim()); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (draft.trim()) onRename(draft.trim()); } if (e.key === "Escape") { setEditing(false); setDraft(fallback); } }}
          className="h-6 flex-1 px-1 text-xs"
        />
      ) : (
        <button onClick={onPick} onDoubleClick={() => { setDraft(fallback); setEditing(true); }} className="flex-1 truncate text-left" title="Double-click to rename">
          {fallback}
        </button>
      )}
      <button onClick={onMoveUp} disabled={!canMoveUp} className="rounded p-1 hover:bg-accent disabled:opacity-30" title="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={onMoveDown} disabled={!canMoveDown} className="rounded p-1 hover:bg-accent disabled:opacity-30" title="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={onToggleVisible} className="rounded p-1 hover:bg-accent" title="Visibility">
        {obj.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onToggleLock} className="rounded p-1 hover:bg-accent" title="Lock">
        {obj.selectable === false ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onDelete} className="rounded p-1 text-destructive hover:bg-destructive/10" title="Delete">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
function toHexInput(v: string): string {
  if (!v) return "#ffffff";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return "#ffffff";
}

function starPoints(spikes: number, outer: number, inner: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  for (let i = 0; i < spikes; i++) {
    pts.push({ x: outer + Math.cos(rot) * outer, y: outer + Math.sin(rot) * outer }); rot += step;
    pts.push({ x: outer + Math.cos(rot) * inner, y: outer + Math.sin(rot) * inner }); rot += step;
  }
  return pts;
}
function arrowPoints(length: number, thickness: number): { x: number; y: number }[] {
  const t = thickness, l = length, head = thickness * 2.4;
  return [
    { x: 0, y: t * 0.5 },
    { x: l - head, y: t * 0.5 },
    { x: l - head, y: 0 },
    { x: l, y: t * 1.2 },
    { x: l - head, y: t * 2.4 },
    { x: l - head, y: t * 1.9 },
    { x: 0, y: t * 1.9 },
  ];
}
