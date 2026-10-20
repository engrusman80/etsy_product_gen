// Curated Adobe-Stock–compliant "in-demand" prompt seeds.
// Each entry is buyer-oriented (business, marketing, editorial, wallpapers, etc.)
// and steers clear of trademarks, real people and copyrighted IP.

export type TrendingPrompt = {
  id: string;
  label: string;      // Short human title shown as a chip
  category: string;   // Loose grouping for UI filtering
  prompt: string;     // The full prompt fed to the image model
  bestFor: ("jpeg" | "png" | "svg" | "wallpaper")[];
  bestAspect?: "1:1" | "3:2" | "16:9" | "2:3" | "9:16" | "4:5" | "9:19.5";
};

export const TRENDING_PROMPTS: TrendingPrompt[] = [
  // ---------- Business & finance (evergreen top-seller) ----------
  {
    id: "biz-team-meeting",
    label: "Diverse team meeting",
    category: "Business",
    prompt:
      "Photorealistic diverse business team of 4 collaborating around a bright modern office table with laptops and coffee, natural window light, soft shallow depth of field, candid corporate lifestyle photography, warm neutral tones, no logos",
    bestFor: ["jpeg"],
    bestAspect: "3:2",
  },
  {
    id: "biz-fintech-dashboard",
    label: "Fintech dashboard hero",
    category: "Business",
    prompt:
      "Clean minimalist 3D isometric illustration of a fintech dashboard with abstract charts, coins and upward growth arrows, soft pastel blue and mint gradient background, generous negative space for headline copy",
    bestFor: ["jpeg", "svg"],
    bestAspect: "16:9",
  },
  // ---------- Lifestyle & wellness ----------
  {
    id: "life-morning-routine",
    label: "Cozy morning routine flat-lay",
    category: "Lifestyle",
    prompt:
      "Top-down flat-lay of a cozy autumn morning: linen bedsheet, ceramic coffee cup, open journal, dried leaves and eucalyptus, soft window light, warm cinematic color grade, negative space top-right",
    bestFor: ["jpeg"],
    bestAspect: "1:1",
  },
  {
    id: "life-yoga-sunrise",
    label: "Sunrise yoga silhouette",
    category: "Lifestyle",
    prompt:
      "Silhouette of a person doing a warrior yoga pose on a quiet beach at sunrise, golden hour, misty ocean, ultra-sharp, editorial wellness photography, warm orange to violet gradient sky",
    bestFor: ["jpeg"],
    bestAspect: "3:2",
  },
  // ---------- Food & drink ----------
  {
    id: "food-brunch",
    label: "Brunch overhead spread",
    category: "Food",
    prompt:
      "Overhead shot of a colorful brunch spread on a marble table: avocado toast, fresh berries, orange juice, pancakes with maple syrup, natural light, food editorial style, ultra sharp, vibrant, no packaging or labels",
    bestFor: ["jpeg"],
    bestAspect: "1:1",
  },
  // ---------- Technology / AI ----------
  {
    id: "tech-ai-abstract",
    label: "Abstract AI network",
    category: "Technology",
    prompt:
      "Abstract 3D render of glowing neural network nodes and light streams on a dark navy background, futuristic cyan-magenta gradient, hero image for AI article, ultra-sharp, cinematic depth",
    bestFor: ["jpeg", "wallpaper"],
    bestAspect: "16:9",
  },
  {
    id: "tech-hands-laptop",
    label: "Hands on laptop close-up",
    category: "Technology",
    prompt:
      "Close-up of hands typing on a silver laptop keyboard, blurred office background with soft bokeh, cool professional color grade, editorial tech photography, no visible logos",
    bestFor: ["jpeg"],
    bestAspect: "3:2",
  },
  // ---------- Nature & landscape (huge wallpaper demand) ----------
  {
    id: "nat-mountain-lake",
    label: "Alpine mountain lake",
    category: "Landscape",
    prompt:
      "Breathtaking alpine lake reflecting snow-capped mountains at sunrise, mist rising from the water, hyper-detailed nature photography, tack-sharp foreground rocks, wide dynamic range, ultra HD",
    bestFor: ["jpeg", "wallpaper"],
    bestAspect: "16:9",
  },
  {
    id: "nat-forest-fog",
    label: "Misty forest path",
    category: "Landscape",
    prompt:
      "Ethereal misty pine forest path at dawn, sun rays cutting through fog, moody atmospheric nature photography, ultra-sharp needles and bark texture, cinematic teal and amber tones",
    bestFor: ["jpeg", "wallpaper"],
    bestAspect: "9:16",
  },
  // ---------- Mobile wallpapers ----------
  {
    id: "wall-liquid-gradient",
    label: "Liquid gradient wallpaper",
    category: "Wallpaper",
    prompt:
      "Ultra-smooth abstract liquid gradient wallpaper, deep purple to hot pink to orange, silky flowing shapes, subtle grain, 8K quality, perfect for phone lock screen",
    bestFor: ["wallpaper", "jpeg"],
    bestAspect: "9:19.5",
  },
  {
    id: "wall-neon-city",
    label: "Neon rainy city wallpaper",
    category: "Wallpaper",
    prompt:
      "Vertical neon-lit rainy city street at night, reflections on wet pavement, cyberpunk atmosphere, moody purple and cyan lighting, cinematic sharp detail, phone wallpaper composition",
    bestFor: ["wallpaper", "jpeg"],
    bestAspect: "9:19.5",
  },
  {
    id: "wall-minimal-mountain",
    label: "Minimal mountain wallpaper",
    category: "Wallpaper",
    prompt:
      "Minimalist flat-illustration wallpaper of layered mountain silhouettes under a pastel sunset with a large full moon, calm and clean, phone wallpaper composition",
    bestFor: ["wallpaper", "svg", "jpeg"],
    bestAspect: "9:19.5",
  },
  // ---------- Seasonal / holidays (year-round bestseller pattern) ----------
  {
    id: "seas-christmas-flatlay",
    label: "Christmas flat-lay",
    category: "Seasonal",
    prompt:
      "Overhead flat-lay of festive holiday season items: pine branches, red berries, cinnamon sticks, wrapped gifts with kraft paper and twine, warm candlelight, negative space center for greeting text, no branded items",
    bestFor: ["jpeg"],
    bestAspect: "1:1",
  },
  // ---------- Vectors / icons ----------
  {
    id: "svg-line-icons",
    label: "Line-art business icons",
    category: "Vector",
    prompt:
      "Set of 16 minimalist single-stroke line-art business icons (laptop, chart, target, lightbulb, briefcase, gear, cloud, chat, calendar, coin, rocket, handshake, shield, mail, phone, checkmark), uniform 2px stroke, arranged in a 4x4 grid on white",
    bestFor: ["svg"],
    bestAspect: "1:1",
  },
  {
    id: "svg-floral-pattern",
    label: "Botanical floral pattern",
    category: "Vector",
    prompt:
      "Seamless vector pattern of hand-drawn botanical wildflowers and leaves, muted sage green and dusty pink palette, elegant, evenly distributed, editable layered paths",
    bestFor: ["svg"],
    bestAspect: "1:1",
  },
  // ---------- Health / medical ----------
  {
    id: "med-stethoscope",
    label: "Doctor with stethoscope",
    category: "Healthcare",
    prompt:
      "Close-up of a doctor in a white coat holding a stethoscope, soft clean hospital background, warm hopeful lighting, editorial healthcare photography, ultra sharp, no visible logos or badges",
    bestFor: ["jpeg"],
    bestAspect: "3:2",
  },
  // ---------- Education ----------
  {
    id: "edu-books-plant",
    label: "Books and plant desk",
    category: "Education",
    prompt:
      "Warm cozy study desk with a stack of hardcover books, a green potted plant, a cup of tea and reading glasses, soft window light, editorial education photography, negative space top",
    bestFor: ["jpeg"],
    bestAspect: "16:9",
  },
  // ---------- Sustainability (rising demand) ----------
  {
    id: "sust-solar-field",
    label: "Solar panels at sunset",
    category: "Sustainability",
    prompt:
      "Aerial shot of a large solar panel farm at golden hour, warm sunlight reflecting off the panels, green fields around, ultra-sharp, hopeful clean-energy editorial photography",
    bestFor: ["jpeg"],
    bestAspect: "16:9",
  },
];

export function filterTrending(assetType: "jpeg" | "png" | "svg" | "wallpaper"): TrendingPrompt[] {
  return TRENDING_PROMPTS.filter((p) => p.bestFor.includes(assetType));
}
