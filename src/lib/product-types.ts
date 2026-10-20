/**
 * Etsy digital product types. Shared by the client (picker, exports, default mockups) and the
 * server routes (design prompt, aspect ratio, SEO context), so keep it free of browser/server APIs.
 */

export type ProductTypeId =
  | "pod-design"
  | "sticker-sheet"
  | "clipart-bundle"
  | "svg-cut-file"
  | "wall-art"
  | "coloring-page"
  | "digital-paper"
  | "tumbler-wrap"
  | "planner-page"
  | "greeting-card"
  | "phone-wallpaper";

/**
 * transparent: art on white that is cut out to a transparent PNG (plus vector trace).
 * full: full-bleed artwork, the whole canvas is the product (no cut-out).
 * white: printable page that keeps its white paper background.
 */
export type Background = "transparent" | "full" | "white";

export type ProductType = {
  id: ProductTypeId;
  label: string;
  /** One line shown under the label in the picker. */
  blurb: string;
  /** Gemini/OpenRouter aspect ratio, width:height. */
  aspectRatio: "1:1" | "2:3" | "3:4" | "4:5" | "5:4" | "9:16";
  background: Background;
  /** Export traced SVG + DXF cut files. */
  vector: boolean;
  /** Art direction appended to the design prompt. */
  art: string;
  /** What the buyer receives, given to the SEO writer and the download cover. */
  receives: string;
  /** File badges on the "digital download" cover mockup. */
  formats: string[];
  /** Mockups selected by default when this type is picked. */
  mockups: string[];
  placeholder: string;
};

export const PRODUCT_TYPES: ProductType[] = [
  {
    id: "pod-design",
    label: "T-shirt / POD design",
    blurb: "Transparent PNG for shirts, mugs and sublimation",
    aspectRatio: "1:1",
    background: "transparent",
    vector: true,
    art: "A single bold standalone graphic made for print-on-demand apparel and sublimation: strong silhouette, high contrast, readable from a distance, limited clean color palette, no background scene.",
    receives:
      "transparent PNG and white-background JPG at 4096px 300 DPI, SVG, DXF, EPS, AI and PDF files for t-shirts, mugs, tote bags and sublimation",
    formats: ["SVG", "EPS", "AI", "PDF", "JPG", "PNG", "DXF"],
    mockups: ["digital-download", "white-tshirt", "black-tshirt", "mug", "tote-bag"],
    placeholder: "Retro sunset mountain adventure t-shirt design, vintage distressed style",
  },
  {
    id: "sticker-sheet",
    label: "Sticker sheet",
    blurb: "6-12 die-cut stickers for Cricut print-then-cut",
    aspectRatio: "3:4",
    background: "transparent",
    vector: true,
    art: "A printable sticker sheet: 6 to 12 separate die-cut sticker designs on one page in a tidy grid, every sticker a self-contained shape with a thick white die-cut outline, clear even spacing between stickers so none touch or overlap, all stickers share one cohesive theme and color palette.",
    receives:
      "a printable sticker sheet as transparent PNG, PDF and JPG at 300 DPI, plus SVG and DXF cut lines for Cricut print then cut and Silhouette",
    formats: ["PNG", "PDF", "JPG", "SVG", "DXF"],
    mockups: ["digital-download", "sticker-sheet-mockup", "sticker"],
    placeholder:
      "Cozy autumn sticker sheet with pumpkins, coffee cups and fall leaves, kawaii style",
  },
  {
    id: "clipart-bundle",
    label: "Clipart bundle",
    blurb: "A set of matching elements on one transparent canvas",
    aspectRatio: "1:1",
    background: "transparent",
    vector: true,
    art: "A clipart bundle: 8 to 12 separate matching illustrated elements arranged in a neat grid with generous white space between them so each can be cut out individually, consistent art style, lighting and palette across every element, no overlapping, no text.",
    receives:
      "a clipart bundle as a transparent PNG at 4096px 300 DPI plus SVG, EPS and PDF files, for scrapbooking, invitations, crafts and commercial use",
    formats: ["PNG", "SVG", "EPS", "PDF", "JPG"],
    mockups: ["digital-download", "clipart-flatlay", "greeting-card"],
    placeholder: "Watercolor wildflower clipart bundle, soft pastel botanicals",
  },
  {
    id: "svg-cut-file",
    label: "Cricut SVG cut file",
    blurb: "Single-color vector for vinyl, HTV and laser",
    aspectRatio: "1:1",
    background: "transparent",
    vector: true,
    art: "A cut-file design for Cricut and Silhouette vinyl cutting: solid flat black shapes only on white, no gradients, no shading, no thin hairlines, no tiny isolated specks, every piece connected or cleanly separated so it weeds easily, bold readable lettering if text is requested.",
    receives:
      "SVG, DXF, EPS, PDF and PNG cut files for Cricut Design Space, Silhouette Studio, vinyl, HTV and laser engraving",
    formats: ["SVG", "DXF", "EPS", "PNG", "PDF"],
    mockups: ["digital-download", "white-tshirt", "wood-sign", "tumbler"],
    placeholder: "Mama bear SVG with floral wreath, single-color cut file",
  },
  {
    id: "wall-art",
    label: "Printable wall art",
    blurb: "Full-bleed 2:3 poster, prints up to 24×36",
    aspectRatio: "2:3",
    background: "full",
    vector: false,
    art: "Printable wall art poster that fills the entire canvas edge to edge (full bleed), gallery-quality composition with intentional negative space, cohesive color palette suitable for home decor, no frame, no wall, no mockup.",
    receives:
      "a high-resolution 2:3 ratio printable poster at 300 DPI as JPG, PNG and PDF that prints at 4x6, 8x12, 12x18, 16x24 and 24x36 inches",
    formats: ["JPG", "PNG", "PDF", "300 DPI", "2:3"],
    mockups: ["digital-download", "wall-frame", "canvas-print", "gallery-wall"],
    placeholder: "Abstract boho sun and arches wall art in terracotta and sage",
  },
  {
    id: "coloring-page",
    label: "Coloring page",
    blurb: "Black line art on white, US Letter portrait",
    aspectRatio: "3:4",
    background: "white",
    vector: true,
    art: "A printable coloring book page: clean bold black outline line art only on pure white paper, closed shapes ready to color, no shading, no gray fill, no color, no hatching, consistent line weight, enough detail to be fun but large enough areas to color.",
    receives:
      "a printable coloring page as PDF, JPG and PNG at 300 DPI sized for US Letter and A4 paper",
    formats: ["PDF", "JPG", "PNG", "Letter", "A4"],
    mockups: ["digital-download", "coloring-page-mockup"],
    placeholder: "Cute mandala cat coloring page for adults",
  },
  {
    id: "digital-paper",
    label: "Seamless digital paper",
    blurb: "Tileable pattern for scrapbooking and fabric",
    aspectRatio: "1:1",
    background: "full",
    vector: false,
    art: "A seamless repeating surface pattern tile that fills the whole square edge to edge: motifs that cross the left edge continue exactly on the right edge and motifs that cross the top continue on the bottom so it tiles with no visible seam, evenly distributed motifs, cohesive palette, flat design, no border.",
    receives:
      "a seamless 12x12 inch digital paper pattern at 300 DPI as JPG, PNG and PDF for scrapbooking, fabric, gift wrap and sublimation",
    formats: ["JPG", "PNG", "PDF", "12×12", "Seamless"],
    mockups: ["digital-download", "digital-paper-mockup", "pillow"],
    placeholder: "Seamless strawberry and gingham digital paper, cottagecore pastel",
  },
  {
    id: "tumbler-wrap",
    label: "Tumbler wrap",
    blurb: "Full-bleed sublimation wrap for 20oz skinny tumblers",
    aspectRatio: "5:4",
    background: "full",
    vector: false,
    art: "A sublimation tumbler wrap design for a 20oz skinny tumbler that fills the entire landscape canvas edge to edge, the pattern and background continue seamlessly from the left edge to the right edge where the wrap meets around the cup, focal artwork centered, rich saturated colors.",
    receives:
      "a 20oz skinny tumbler sublimation wrap at 300 DPI as PNG, JPG and PDF, straight wrap ready to print",
    formats: ["PNG", "JPG", "PDF", "20oz", "300 DPI"],
    mockups: ["digital-download", "tumbler"],
    placeholder: "Sunflower and leopard print tumbler wrap",
  },
  {
    id: "planner-page",
    label: "Planner / journal page",
    blurb: "Printable or GoodNotes page, US Letter portrait",
    aspectRatio: "3:4",
    background: "white",
    vector: false,
    art: "A printable planner or journal page on white paper: a clean structured layout with clear sections, ruled lines, checkboxes and headings, minimal decorative accents in a soft palette, plenty of writing space, all headings spelled correctly in English, crisp typography.",
    receives:
      "a printable planner page as PDF, PNG and JPG at 300 DPI for US Letter and A4, also usable in GoodNotes and Notability",
    formats: ["PDF", "PNG", "JPG", "GoodNotes"],
    mockups: ["digital-download", "planner-mockup", "ipad-planner"],
    placeholder: "Minimalist weekly planner page with habit tracker, sage green",
  },
  {
    id: "greeting-card",
    label: "Greeting card / invitation",
    blurb: "5×7 portrait card front, print at home",
    aspectRatio: "3:4",
    background: "full",
    vector: false,
    art: "The front of a 5x7 inch greeting card or invitation in portrait orientation, elegant composition with decorative illustration and space for the requested wording, full bleed background, refined typography, spell any requested text exactly.",
    receives:
      "a printable 5x7 inch greeting card or invitation at 300 DPI as PDF, JPG and PNG, ready to print at home or at a print shop",
    formats: ["PDF", "JPG", "PNG", "5×7"],
    mockups: ["digital-download", "greeting-card", "invitation-flatlay"],
    placeholder: "Floral watercolor birthday card that says Happy Birthday",
  },
  {
    id: "phone-wallpaper",
    label: "Phone wallpaper",
    blurb: "9:16 lock-screen art for iPhone and Android",
    aspectRatio: "9:16",
    background: "full",
    vector: false,
    art: "A vertical phone wallpaper that fills the entire 9:16 canvas edge to edge, keep the top quarter calm and uncluttered for the lock-screen clock, main subject in the lower middle, aesthetic cohesive palette, no phone frame, no UI elements, no text unless requested.",
    receives:
      "a high-resolution 9:16 phone wallpaper as PNG and JPG for iPhone and Android lock and home screens",
    formats: ["PNG", "JPG", "9:16", "iPhone", "Android"],
    mockups: ["digital-download", "phone-screen"],
    placeholder: "Dreamy pastel moon and clouds aesthetic phone wallpaper",
  },
];

export const DEFAULT_PRODUCT_TYPE: ProductTypeId = "pod-design";

export function getProductType(id: unknown): ProductType {
  return PRODUCT_TYPES.find((t) => t.id === id) ?? PRODUCT_TYPES[0];
}

/** Width/height of an aspect ratio string as numbers, e.g. "2:3" → [2, 3]. */
export function ratioOf(t: ProductType): [number, number] {
  const [w, h] = t.aspectRatio.split(":").map(Number);
  return [w || 1, h || 1];
}
