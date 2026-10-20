// Structured crochet pattern shape returned by /api/crochet-pattern.

export type CrochetSection = {
  /** Section title e.g. "Head", "Body", "Handle" */
  name: string;
  /** Rounds/rows as short strings, e.g. "R1: 6 sc in MR (6)" */
  rows: string[];
  /** Optional notes for this section */
  notes?: string[];
};

export type CrochetPattern = {
  title: string; // 60-100 char product title
  subtitle: string; // 1-line tagline
  skillLevel: "Beginner" | "Advanced Beginner" | "Intermediate" | "Advanced";
  finishedSize: string; // e.g. "≈ 15 cm tall"
  gauge: string; // e.g. "16 sc x 18 rows = 10 cm"
  terminology: "US" | "UK";
  materials: {
    hooks: string[]; // ["3.0 mm crochet hook"]
    yarn: string[]; // ["Worsted-weight cotton, ivory 100g", ...]
    notions: string[]; // ["yarn needle", "6mm safety eyes x2", ...]
  };
  abbreviations: { key: string; meaning: string }[]; // {key:"sc", meaning:"single crochet"}
  specialStitches?: { name: string; how: string }[];
  sections: CrochetSection[]; // ordered pattern sections
  assembly: string[]; // step-by-step finishing/joining
  care: string[]; // wash / block / storage
  copyright: string; // 1-line license notice
  /** Simple stitch-chart data: each entry is a round; symbols are the abbreviation for each stitch. */
  chartRounds?: { label: string; symbols: string[] }[];
  /** Seed used to generate this pattern — for duplicate detection */
  seed?: string;
};
