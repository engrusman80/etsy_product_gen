/**
 * Google retires Gemini model names for new keys (e.g. gemini-2.5-flash now returns 404 for new
 * users), so pick the newest model the user's own key can call instead of hard-coding one.
 */

export type GeminiKind = "text" | "textPro" | "imagePro" | "imageFast";

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; names: string[] }>();

async function listModels(key: string): Promise<string[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.names;
  const names: string[] = [];
  try {
    let pageToken = "";
    for (let page = 0; page < 5; page++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const j = (await res.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
        nextPageToken?: string;
      };
      for (const m of j.models ?? []) {
        if (m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
          names.push(m.name.replace(/^models\//, ""));
      }
      if (!j.nextPageToken) break;
      pageToken = encodeURIComponent(j.nextPageToken);
    }
  } catch {
    /* fall back to defaults */
  }
  if (names.length) cache.set(key, { at: Date.now(), names });
  return names;
}

const version = (n: string) => parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
const NOT_TEXT = /image|tts|audio|live|embedding|vision|robotics|computer|native|thinking|lite/;

const RULES: Record<GeminiKind, { match: (n: string) => boolean; fallbackMatch?: RegExp }> = {
  text: {
    match: (n) => /^gemini-[\d.]+-flash(-latest|-preview[-\w]*)?$/.test(n) && !NOT_TEXT.test(n),
  },
  textPro: {
    match: (n) => /^gemini-[\d.]+-pro(-latest|-preview[-\w]*)?$/.test(n) && !NOT_TEXT.test(n),
  },
  imagePro: { match: (n) => /^gemini-[\d.]+-pro-image/.test(n) },
  imageFast: {
    match: (n) => /^gemini-[\d.]+-flash-image/.test(n),
    fallbackMatch: /^gemini-[\d.]+-flash-lite-image/,
  },
};

/** Newest matching model; stable names win over previews of the same version. */
export function pickGeminiModel(names: string[], kind: GeminiKind): string | undefined {
  const rule = RULES[kind];
  const rank = (list: string[]) =>
    list.sort((a, b) => {
      const dv = version(b) - version(a);
      if (dv) return dv;
      const pa = /preview|exp/.test(a) ? 1 : 0;
      const pb = /preview|exp/.test(b) ? 1 : 0;
      return pa - pb || a.length - b.length;
    })[0];
  const main = names.filter(rule.match);
  if (main.length) return rank(main);
  if (rule.fallbackMatch) {
    const alt = names.filter((n) => rule.fallbackMatch!.test(n));
    if (alt.length) return rank(alt);
  }
  return undefined;
}

export async function geminiModel(
  key: string,
  kind: GeminiKind,
  fallback: string,
): Promise<string> {
  return pickGeminiModel(await listModels(key), kind) ?? fallback;
}

/** Google's 404 for a retired model names its replacement ("...use models/gemini-x-flash..."). */
export function replacementFromError(message: string): string | undefined {
  return message.match(/use models\/(gemini-[\w.-]+)/)?.[1];
}

const LITE_TEXT = (n: string) =>
  /^gemini-[\d.]+-flash-lite(-latest|-preview[-\w]*)?$/.test(n) ||
  /^gemini-flash(-lite)?-latest$/.test(n);
const lastGood = new Map<string, string>();

/**
 * Text models to try in order. Each Gemini model has its own free quota, so when one is used up
 * (429) the caller moves on to the next: newest Pro (pro tier only), newest Flash, then Lite.
 */
export async function geminiTextCandidates(key: string, tier: "fast" | "pro"): Promise<string[]> {
  const names = await listModels(key);
  if (!names.length)
    return tier === "pro" ? ["gemini-2.5-pro", "gemini-2.5-flash"] : ["gemini-2.5-flash"];
  const ranked = (match: (n: string) => boolean) => {
    const out: string[] = [];
    let rest = names.filter(match);
    while (rest.length) {
      const best = pickGeminiModel(rest, "text") ?? pickGeminiModel(rest, "textPro") ?? rest[0];
      out.push(best);
      rest = rest.filter((n) => n !== best);
    }
    return out;
  };
  const list = [
    ...(tier === "pro" ? ranked(RULES.textPro.match).slice(0, 2) : []),
    ...ranked(RULES.text.match).slice(0, 3),
    ...names
      .filter(LITE_TEXT)
      .sort((a, b) => version(b) - version(a))
      .slice(0, 3),
  ];
  const good = lastGood.get(`${key}:${tier}`);
  const uniq = [...new Set(list)];
  return good && uniq.includes(good) ? [good, ...uniq.filter((n) => n !== good)] : uniq;
}

export function rememberWorkingModel(key: string, tier: "fast" | "pro", model: string) {
  lastGood.set(`${key}:${tier}`, model);
}
