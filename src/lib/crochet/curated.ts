// Curated pool of Etsy-trending crochet pattern ideas. Rotated randomly.
// Categories: amigurumi, wearables, blankets/homeware, bags/accessories, seasonal.

export const CURATED_CROCHET_IDEAS: string[] = [
  // Amigurumi
  "Sleepy cloud amigurumi with rainbow tail",
  "Tiny mushroom family amigurumi set (5 sizes)",
  "Chubby honeybee keychain amigurumi",
  "Cottagecore fox amigurumi with acorn",
  "Space astronaut cat amigurumi",
  "Rainbow octopus amigurumi with curly tentacles",
  "Sushi roll plush amigurumi trio",
  "Baby dragon amigurumi with removable wings",
  "Kawaii avocado couple amigurumi",
  "Miniature pumpkin gnome amigurumi",
  "Bumblebee bee amigurumi with fuzzy antennae",
  "Frog prince amigurumi with detachable crown",
  "Sleepy sloth hanging amigurumi",
  "Highland cow amigurumi with fringe",
  "Tiny turtle keychain amigurumi (beginner)",

  // Wearables
  "Chunky oversized cardigan (sizes XS–3XL)",
  "Cropped granny square vest",
  "Boho fringe kimono cover-up",
  "Slouchy beanie with faux-fur pom",
  "Ribbed alpaca beanie unisex",
  "Cable-knit look infinity scarf",
  "Puff-stitch bucket hat summer",
  "Mesh crop top festival wear",
  "Statement collar removable (cottagecore)",
  "Fingerless mitts with thumb gusset",
  "Baby booties heirloom set (0-12m)",
  "Toddler pixie hood with ears",
  "Newborn cocoon photography prop",
  "Chunky wool leg warmers",
  "Off-shoulder mesh beach dress",

  // Blankets & homeware
  "Modern granny square throw blanket (60x60)",
  "Sunburst mandala floor cushion",
  "Corner-to-corner minimalist baby blanket",
  "Bobble-stitch tulip pillow cover",
  "Mosaic overlay hexagon rug",
  "Waffle-stitch dish cloth set (3 pack)",
  "Boho macramé-style wall hanging",
  "Farmhouse basket weave storage bin",
  "Chunky arm-knit look pouf cover",
  "Tapestry landscape wall art (mountains)",
  "Seed-stitch minimalist table runner",
  "Chevron ripple afghan (queen size)",
  "Puff-stitch nursery mobile",
  "Amigurumi book nook diorama",
  "Coaster set — vintage flowers (6 pack)",

  // Bags & accessories
  "Market tote with jute handles",
  "Crossbody phone bag with tassel",
  "Bobble bucket bag cottagecore",
  "Mini coin purse frog closure",
  "Raffia straw beach bag",
  "Backpack with drawstring & flap",
  "Wristlet clutch evening gold",
  "Bookish tote with pocket for pen",
  "Laptop sleeve with strap 13/15 inch",
  "Sunglasses pouch with pom",

  // Seasonal / holiday
  "Halloween pumpkin garland (mini)",
  "Christmas ornament set — 12 pieces",
  "Easter egg cozy amigurumi bunny",
  "Valentine heart granny square blanket",
  "Autumn leaf table runner",
  "Snowflake applique set (12 designs)",
  "Halloween ghost trick-or-treat bag",
  "Christmas tree skirt heirloom",
  "Spring tulip bouquet everlasting",
  "Thanksgiving turkey napkin ring set",
];

export function pickIdeas(n = 8): string[] {
  const pool = [...CURATED_CROCHET_IDEAS];
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
