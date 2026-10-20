// Injects randomized style/composition/lighting seeds into every prompt so
// two runs of the same idea produce visibly different artwork. Reduces
// Adobe Stock "too similar to existing content" rejections.

const CAMERA_ANGLES = [
  "unusual low-angle worm's-eye view",
  "steep top-down flat-lay 90° overhead",
  "dutch-tilted 15° diagonal framing",
  "extreme close-up macro perspective",
  "wide 24mm environmental context shot",
  "isometric 30° three-quarter view",
  "over-the-shoulder implied perspective",
  "profile side-elevation composition",
  "asymmetric off-center rule-of-thirds framing",
  "symmetrical dead-center hero framing",
];
const LIGHTING = [
  "golden-hour warm side-light with long shadows",
  "cool overcast diffused north-light",
  "moody chiaroscuro single-source rim-light",
  "high-key soft studio softbox lighting",
  "neon dual-tone cyan+magenta gel lighting",
  "candle-lit warm 1800K amber glow",
  "backlit silhouette with sun flare",
  "clean shadowless bounced studio light",
  "dramatic split-light 50/50 shadow",
  "hazy volumetric god-rays through window",
];
const PALETTES = [
  "muted earth-tone palette (terracotta, sage, cream, rust)",
  "high-contrast complementary teal + coral palette",
  "monochrome tonal palette with a single accent color",
  "pastel spring palette (blush, mint, butter, lilac)",
  "deep jewel-tone palette (emerald, sapphire, amethyst, garnet)",
  "warm sunset gradient palette (peach, tangerine, magenta)",
  "cool nordic palette (icy blue, slate, white, birch)",
  "bold retro 70s palette (mustard, avocado, brick, chocolate)",
];
const COMPOSITION = [
  "generous negative space top-left for copy",
  "layered depth with clear fore/mid/background separation",
  "dynamic diagonal leading lines",
  "circular flow guiding the eye around the frame",
  "minimal single-hero-subject composition",
  "densely arranged textural composition edge-to-edge",
];
const STYLE_TWISTS = [
  "with subtle film-grain and imperfect analog character",
  "with hand-crafted tactile texture (paper, linen, or brush strokes)",
  "with a fresh unexpected object pairing that avoids typical stock clichés",
  "with an unconventional prop or seasonal detail rarely seen in stock imagery",
  "with a genuine imperfect real-world touch (bokeh, dust, or slight wear)",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Returns 2–3 short sentences to append to the prompt so each run is unique. */
export function originalitySeed(): string {
  const seedNum = Math.floor(Math.random() * 900000 + 100000);
  return [
    `Composition seed #${seedNum}: ${pick(CAMERA_ANGLES)}, ${pick(LIGHTING)}.`,
    `Palette: ${pick(PALETTES)}. Layout: ${pick(COMPOSITION)}.`,
    `Make it distinctive ${pick(STYLE_TWISTS)}. Avoid overused stock-photo tropes, generic AI aesthetics, and any composition that resembles common existing stock imagery. Deliver a fresh, original, commercially unique concept.`,
  ].join(" ");
}

/** Extra prompt clause pushing the model toward vector-clean, zoom-proof edges. */
export const SHARPNESS_CLAUSE =
  "CRITICAL RENDERING QUALITY: tack-sharp micro-detail visible at 400–800% zoom, vector-clean crisp edges, smooth anti-aliased curves, perfectly defined contours, zero blur, zero softness, zero JPEG artifacts, zero chromatic aberration, zero halos, zero mushy AI textures. Every edge, line, shape and typographic form must remain razor-sharp and pixel-perfect at extreme zoom levels — comparable to Adobe Illustrator vector output. Fine textures must retain individual detail (each hair, thread, leaf-vein, pore, or grain distinctly resolved).";
