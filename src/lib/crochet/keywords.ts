import { etsyConnected, todayKey } from "@/lib/etsy/client";
import { aiPost, marketFor } from "@/lib/etsy/growth";
import { loadSettings, textProvider, type Settings } from "@/lib/settings-store";

/** Daily trending crochet pattern keywords, kept in this browser. */

export type TrendKeyword = {
  keyword: string;
  why: string;
  sources: { title: string; url: string }[];
  /** Active Etsy listings for the phrase, when the shop is connected. */
  competition?: number;
  /** Average favorites on the top results: a rough sign of buyer interest. */
  favorites?: number;
};

export type KeywordDay = {
  date: string;
  /** False when the AI could not search the web and used its own knowledge. */
  searched: boolean;
  items: TrendKeyword[];
};

const KEY = "etsyforge:crochet-keywords";
const TRIED_KEY = "etsyforge:crochet-keywords-tried";

/** The first two days were researched before this panel existed. */
const SEED: KeywordDay[] = [
  {
    date: "2026-10-21",
    searched: true,
    items: [
      {
        keyword: "crochet pillbox hat pattern",
        why: "WhoWhatWear lists the pillbox hat as a 2026 hat trend; no crochet pillbox pattern showed up on Etsy.",
        sources: [
          {
            title: "Hat trends 2026",
            url: "https://www.whowhatwear.com/fashion/trends/hat-trends-2026",
          },
        ],
      },
      {
        keyword: "faux fur trapper hat crochet pattern",
        why: "Oversized faux fur trapper hats are a FW26 accessory prediction; no Etsy pattern found.",
        sources: [
          {
            title: "FW26 accessories trend predictions",
            url: "https://fashionunited.com/news/fashion/fw26-accessories-trend-predictions-big-faux-fur-multi-belt-styling-and-more/2026013070294",
          },
        ],
      },
      {
        keyword: "crochet argyle sweater vest pattern",
        why: "Preppy argyle and vests are fall 2026 trends; no crochet argyle vest pattern found on Etsy.",
        sources: [
          {
            title: "Fall 2026 knitting and crochet trends",
            url: "https://www.knitpro.eu/usa/blog/fall-2026-knitting-crochet-trends",
          },
        ],
      },
      {
        keyword: "3d flower crochet scarf pattern",
        why: "3D scarves are a 2026 trend; Etsy sells finished 3D flower scarves (about $84) but no pattern was found.",
        sources: [
          {
            title: "Knit and crochet trends 2026",
            url: "https://www.lanternmoon.com/blogs/blog-post/knit-crochet-fashion-trends-2026",
          },
        ],
      },
      {
        keyword: "faux fur stole crochet pattern",
        why: "Faux fur wraps and stoles are a FW26 accessory prediction; no Etsy pattern found.",
        sources: [],
      },
      {
        keyword: "surface crochet embroidered sweater pattern",
        why: "Surface crochet embroidery is a fall 2026 trend; Etsy showed only plain sweater patterns.",
        sources: [
          {
            title: "Crochet trends shaping autumn 2026",
            url: "https://www.knitpro.eu/usa/blog/crochet-trends-autumn-fashion-fall-2026",
          },
        ],
      },
    ],
  },
  {
    date: "2026-10-20",
    searched: true,
    items: [
      {
        keyword: "crochet lace collar bomber jacket pattern",
        why: "Pinterest Predicts 2026 'Laced Up' names crochet and lacy collars; no such pattern found on Etsy.",
        sources: [],
      },
      {
        keyword: "crochet tummy time play mat pattern",
        why: "Pinterest's 2026 retro trend names crochet play mats; only about one dedicated Etsy pattern found.",
        sources: [],
      },
      {
        keyword: "filet lace crochet phone case pattern",
        why: "Pinterest 'Laced Up' names crochet phone cases; Etsy has phone bags but no lace or filet ones.",
        sources: [],
      },
      {
        keyword: "sheer filet cutout crochet cardigan pattern",
        why: "Sheer and cutout knitwear is a fall 2026 trend; no matching Etsy pattern found.",
        sources: [],
      },
      {
        keyword: "boucle crochet cardigan pattern",
        why: "Boucle texture is called a leading 2026 trend; very few boucle cardigan patterns on Etsy.",
        sources: [],
      },
      {
        keyword: "mosaic crochet halloween pillow pattern",
        why: "Seasonal October demand; Etsy has mostly mosaic blankets with a pillow option.",
        sources: [],
      },
    ],
  },
];

export function loadKeywordDays(): KeywordDay[] {
  let days: KeywordDay[] = [];
  try {
    days = JSON.parse(localStorage.getItem(KEY) || "[]") as KeywordDay[];
  } catch {
    /* start over */
  }
  const have = new Set(days.map((d) => d.date));
  return [...days, ...SEED.filter((d) => !have.has(d.date))].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

function saveKeywordDays(days: KeywordDay[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(days.slice(0, 60)));
  } catch {
    /* ignore */
  }
}

/** The once-a-day search is due: nothing for today yet and no failed try today. */
export function keywordsDue(): boolean {
  if (loadKeywordDays().some((d) => d.date === todayKey())) return false;
  try {
    return localStorage.getItem(TRIED_KEY) !== todayKey();
  } catch {
    return true;
  }
}

/** Fewer competing listings and more favorites on the top results rank higher. */
const score = (k: TrendKeyword) =>
  k.competition == null ? 0 : ((k.favorites ?? 0) + 1) / Math.log10(k.competition + 10);

/** Asks the AI for today's keywords, measures them on Etsy when connected, and keeps them. */
export async function findTodayKeywords(): Promise<KeywordDay> {
  try {
    localStorage.setItem(TRIED_KEY, todayKey());
  } catch {
    /* ignore */
  }
  const days = loadKeywordDays();
  const r = await aiPost<{ keywords: TrendKeyword[]; searched: boolean }>("/api/trend-keywords", {
    avoid: days.flatMap((d) => d.items.map((i) => i.keyword)),
    count: 10,
  });
  let items = r.keywords;
  if (etsyConnected(loadSettings())) {
    try {
      const markets = await marketFor(items.map((i) => i.keyword));
      items = items
        .map((i, n) => {
          const m = markets[n];
          return m && !m.error ? { ...i, competition: m.count, favorites: m.avgFavorites } : i;
        })
        .sort((a, b) => score(b) - score(a));
    } catch {
      /* keep the list without Etsy numbers */
    }
  }
  // "Find more" on the same day adds to today's list instead of replacing it.
  const earlier = days.find((d) => d.date === todayKey());
  const day: KeywordDay = {
    date: todayKey(),
    searched: r.searched && (earlier?.searched ?? true),
    items: [...(earlier?.items ?? []), ...items.slice(0, 8)],
  };
  saveKeywordDays([day, ...days.filter((d) => d.date !== day.date)]);
  return day;
}

/** Rough cost of one search with the AI that writes text now. */
export function keywordSearchCost(s: Settings): string {
  const p = textProvider(s);
  if (p === "anthropic") return "about $0.20 to $0.40 with Claude web search";
  if (p === "openrouter") return "about $0.03 with OpenRouter web search";
  return "nothing on a free Gemini key (no web search there), about $0.01 with billing on";
}
