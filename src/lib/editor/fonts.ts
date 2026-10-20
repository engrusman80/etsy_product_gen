// Curated multilingual font catalog for the image editor.
// Latin / common families ship bundled via @fontsource so Studio works fully
// offline. Multilingual families (CJK, Indic, Naskh, Nastaliq, Hebrew, Thai)
// stay on the Google CDN — bundling them would add tens of MB.
// After first load the browser caches the CDN response.

// ----- Bundled (offline) fonts — eagerly imported -------------------------
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/anton/400.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/700.css";
import "@fontsource/lobster/400.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/permanent-marker/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/700.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";

export type FontDef = {
  family: string;
  /** Google Fonts CSS2 spec for CDN-only families, e.g. "Inter:wght@400;700" */
  spec?: string;
  /** True if the font is bundled via @fontsource (no network needed). */
  bundled?: boolean;
  group: "Sans" | "Serif" | "Display" | "Script" | "Mono" | "CJK" | "Indic" | "Arabic" | "Urdu";
  langs?: string;
};

export const FONTS: FontDef[] = [
  // Bundled — offline-ready
  { family: "Inter", group: "Sans", bundled: true },
  { family: "Roboto", group: "Sans", bundled: true },
  { family: "Montserrat", group: "Sans", bundled: true },
  { family: "Poppins", group: "Sans", bundled: true },
  { family: "Oswald", group: "Sans", bundled: true },
  { family: "Bebas Neue", group: "Display", bundled: true },
  { family: "Anton", group: "Display", bundled: true },
  { family: "Archivo Black", group: "Display", bundled: true },
  { family: "Playfair Display", group: "Serif", bundled: true },
  { family: "Merriweather", group: "Serif", bundled: true },
  { family: "Lora", group: "Serif", bundled: true },
  { family: "Lobster", group: "Script", bundled: true },
  { family: "Pacifico", group: "Script", bundled: true },
  { family: "Dancing Script", group: "Script", bundled: true },
  { family: "Permanent Marker", group: "Display", bundled: true },
  { family: "JetBrains Mono", group: "Mono", bundled: true },
  { family: "Fira Code", group: "Mono", bundled: true },
  { family: "Cairo", group: "Arabic", bundled: true, langs: "العربية" },
  { family: "Amiri", group: "Arabic", bundled: true, langs: "العربية" },

  // CDN-only (large multilingual families)
  { family: "Great Vibes", spec: "Great+Vibes", group: "Script" },
  { family: "Caveat", spec: "Caveat:wght@400;500;600;700", group: "Script" },
  {
    family: "Cormorant Garamond",
    spec: "Cormorant+Garamond:wght@300;400;500;600;700",
    group: "Serif",
  },
  {
    family: "Noto Sans SC",
    spec: "Noto+Sans+SC:wght@400;500;700;900",
    group: "CJK",
    langs: "中文",
  },
  {
    family: "Noto Serif SC",
    spec: "Noto+Serif+SC:wght@400;500;700;900",
    group: "CJK",
    langs: "中文",
  },
  {
    family: "Noto Sans JP",
    spec: "Noto+Sans+JP:wght@400;500;700;900",
    group: "CJK",
    langs: "日本語",
  },
  {
    family: "Noto Serif JP",
    spec: "Noto+Serif+JP:wght@400;500;700;900",
    group: "CJK",
    langs: "日本語",
  },
  {
    family: "Noto Sans KR",
    spec: "Noto+Sans+KR:wght@400;500;700;900",
    group: "CJK",
    langs: "한국어",
  },
  {
    family: "Noto Sans Devanagari",
    spec: "Noto+Sans+Devanagari:wght@400;500;700;900",
    group: "Indic",
    langs: "हिन्दी",
  },
  {
    family: "Noto Serif Devanagari",
    spec: "Noto+Serif+Devanagari:wght@400;500;700;900",
    group: "Indic",
    langs: "हिन्दी",
  },
  {
    family: "Noto Sans Bengali",
    spec: "Noto+Sans+Bengali:wght@400;500;700;900",
    group: "Indic",
    langs: "বাংলা",
  },
  {
    family: "Noto Sans Tamil",
    spec: "Noto+Sans+Tamil:wght@400;500;700;900",
    group: "Indic",
    langs: "தமிழ்",
  },
  {
    family: "Noto Sans Telugu",
    spec: "Noto+Sans+Telugu:wght@400;500;700;900",
    group: "Indic",
    langs: "తెలుగు",
  },
  {
    family: "Noto Sans Gujarati",
    spec: "Noto+Sans+Gujarati:wght@400;500;700;900",
    group: "Indic",
    langs: "ગુજરાતી",
  },
  {
    family: "Noto Naskh Arabic",
    spec: "Noto+Naskh+Arabic:wght@400;500;600;700",
    group: "Arabic",
    langs: "العربية",
  },
  {
    family: "Noto Nastaliq Urdu",
    spec: "Noto+Nastaliq+Urdu:wght@400;500;600;700",
    group: "Urdu",
    langs: "اُردُو",
  },
  {
    family: "Noto Sans Thai",
    spec: "Noto+Sans+Thai:wght@400;500;700;900",
    group: "Sans",
    langs: "ไทย",
  },
  {
    family: "Noto Sans Hebrew",
    spec: "Noto+Sans+Hebrew:wght@400;500;700;900",
    group: "Sans",
    langs: "עברית",
  },
];

export const RTL_FAMILIES = new Set(
  FONTS.filter(
    (f) => f.group === "Arabic" || f.group === "Urdu" || f.family === "Noto Sans Hebrew",
  ).map((f) => f.family),
);

let _cdnLoaded = false;
export function injectFonts() {
  if (_cdnLoaded || typeof document === "undefined") return;
  if (document.getElementById("editor-google-fonts")) {
    _cdnLoaded = true;
    return;
  }
  const cdnFonts = FONTS.filter((f) => !f.bundled && f.spec);
  if (cdnFonts.length === 0) {
    _cdnLoaded = true;
    return;
  }
  const families = cdnFonts.map((f) => `family=${f.spec}`).join("&");
  const link = document.createElement("link");
  link.id = "editor-google-fonts";
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);

  const pre1 = document.createElement("link");
  pre1.rel = "preconnect";
  pre1.href = "https://fonts.googleapis.com";
  document.head.appendChild(pre1);

  const pre2 = document.createElement("link");
  pre2.rel = "preconnect";
  pre2.href = "https://fonts.gstatic.com";
  pre2.crossOrigin = "anonymous";
  document.head.appendChild(pre2);

  _cdnLoaded = true;
}

/** Ensure a font face is loaded before rendering it on canvas. */
export async function ensureFont(family: string, weight: number | string = 600): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.load(`${weight} 24px "${family}"`);
  } catch {
    // ignore
  }
}
