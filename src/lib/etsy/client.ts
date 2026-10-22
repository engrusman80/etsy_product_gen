import { loadSettings, saveSettings, type Settings } from "@/lib/settings-store";

/** Browser side of the Etsy connection: OAuth (PKCE), token refresh and calls to /api/etsy. */

const SCOPES = "listings_r listings_w shops_r";
const VERIFIER_KEY = "etsyforge:etsy-pkce";

/** Must match the callback URL saved in the Etsy app; both paths below lead to the same page. */
export const etsyRedirectUri = (viaApi = false) =>
  `${window.location.origin}${viaApi ? "/api/etsy/callback" : "/etsy/callback"}`;
export const etsyConnected = (s: Settings) => !!(s.etsyRefresh && s.etsyShopId);

function b64url(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type PendingConnect = { verifier: string; state: string; redirectUri: string };

/** Builds the Etsy approval link and remembers the PKCE values for the way back. */
export async function etsyConnectLink(s: Settings): Promise<string> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  const redirectUri = etsyRedirectUri(s.etsyCallbackApi);
  // localStorage, not sessionStorage: a phone sign-in can take a while and the page may reload.
  const pending: PendingConnect = { verifier, state, redirectUri };
  localStorage.setItem(VERIFIER_KEY, JSON.stringify(pending));
  const q = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    client_id: s.etsyKeystring,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://www.etsy.com/oauth/connect?${q}`;
}

/** Sends the user to Etsy to approve access; Etsy returns to /etsy/callback. */
export async function startEtsyConnect(s: Settings) {
  window.location.href = await etsyConnectLink(s);
}

async function post<T>(s: Settings, body: unknown, token?: string): Promise<T> {
  const res = await fetch("/api/etsy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Etsy-Key": s.etsyKeystring,
      "X-Etsy-Secret": s.etsySecret,
      ...(token ? { "X-Etsy-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(j.error || `Etsy request failed (${res.status})`);
  return j;
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

function withTokens(s: Settings, t: Tokens): Settings {
  return {
    ...s,
    etsyAccess: t.access_token,
    etsyRefresh: t.refresh_token,
    etsyExpiresAt: Date.now() + t.expires_in * 1000,
  };
}

/** Finishes "Connect Etsy" on the callback page. */
export async function finishEtsyConnect(
  code: string,
  state: string,
  viaApi: boolean,
): Promise<Settings> {
  const saved = JSON.parse(
    localStorage.getItem(VERIFIER_KEY) || sessionStorage.getItem(VERIFIER_KEY) || "{}",
  ) as Partial<PendingConnect>;
  if (!saved.verifier || saved.state !== state)
    throw new Error("This Etsy sign-in link expired. Press Connect Etsy again.");
  localStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  let s = loadSettings();
  const t = await post<Tokens>(s, {
    action: "token",
    code,
    verifier: saved.verifier,
    redirectUri: saved.redirectUri || etsyRedirectUri(viaApi),
  });
  s = withTokens(s, t);
  const shop = await post<{ shopId: number; shopName: string }>(
    s,
    { action: "shop" },
    s.etsyAccess,
  );
  s = { ...s, etsyShopId: shop.shopId, etsyShopName: shop.shopName };
  saveSettings(s);
  return s;
}

/**
 * Finishes a sign-in approved on another device: Etsy sends that device to this computer's
 * localhost address, which it cannot open, so the user pastes that address here.
 */
export async function finishEtsyConnectFromAddress(address: string): Promise<Settings> {
  const raw = address.trim();
  const query = (raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw).split("#")[0];
  const q = new URLSearchParams(query);
  const code = q.get("code");
  if (!code)
    throw new Error(
      q.get("error_description") ||
        q.get("error") ||
        "That address has no Etsy code. Copy the whole address from the phone after pressing Allow access.",
    );
  return finishEtsyConnect(code, q.get("state") || "", raw.includes("/api/etsy/callback"));
}

/** Calls /api/etsy with a fresh access token, refreshing and saving it when needed. */
export async function etsyCall<T>(body: Record<string, unknown>): Promise<T> {
  let s = loadSettings();
  if (!etsyConnected(s)) throw new Error("Connect your Etsy shop in Settings first.");
  if (!s.etsyAccess || Date.now() > s.etsyExpiresAt - 60_000) {
    try {
      s = withTokens(s, await post<Tokens>(s, { action: "refresh", refreshToken: s.etsyRefresh }));
    } catch (e) {
      throw new Error(
        `Etsy sign-in expired, press Connect Etsy in Settings again. (${(e as Error).message})`,
      );
    }
    saveSettings(s);
  }
  return post<T>(s, { ...body, shopId: s.etsyShopId }, s.etsyAccess);
}

export type DraftResult = {
  listingId: number;
  category: string;
  editUrl: string;
  problems: string[];
};

export const blobToB64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/** Etsy limit for each digital file. */
export const ETSY_FILE_MAX = 20 * 1024 * 1024;

export async function saveEtsyDraft(d: {
  title: string;
  description: string;
  tags: string[];
  price: number;
  taxonomyWords: string[];
  images: string[];
  files: { name: string; blob: Blob }[];
}): Promise<DraftResult> {
  const files = [];
  for (const f of d.files) {
    if (f.blob.size > ETSY_FILE_MAX) continue;
    files.push({ name: f.name, base64: await blobToB64(f.blob) });
  }
  return etsyCall<DraftResult>({
    action: "draft",
    draft: { ...d, files },
  });
}

/* ------------------------------------------------------------------ daily queue */

export type DailyItem = {
  id: string;
  idea: string;
  /** Product type id, or "crochet" for a crochet pattern. */
  kind: string;
  doneAt?: string;
  listingId?: number;
  editUrl?: string;
  error?: string;
  /** Day of the last failed try, so a failing idea is retried once a day, not on every open. */
  triedAt?: string;
  /** Etsy numbers when the app picked this idea by demand. */
  competition?: number;
  favorites?: number;
};

const QUEUE_KEY = "etsyforge:daily-queue";
const CHECK_KEY = "etsyforge:shop-check";

/** Local calendar day, so "today" turns over at the user's midnight. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function loadQueue(): DailyItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as DailyItem[];
  } catch {
    return [];
  }
}

export function saveQueue(q: DailyItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

/** Drafts already made today. */
export const draftsToday = () => loadQueue().filter((i) => i.doneAt === today()).length;

/** Queued ideas still to make today, up to the per-day limit; failed ones wait until tomorrow. */
export function dueDailyItems(perDay: number): DailyItem[] {
  const left = Math.max(0, perDay - draftsToday());
  return loadQueue()
    .filter((i) => !i.doneAt && i.triedAt !== today())
    .slice(0, left);
}

export function markDaily(id: string, patch: Partial<DailyItem>) {
  const extra = patch.error && !patch.doneAt ? { triedAt: today() } : {};
  saveQueue(loadQueue().map((i) => (i.id === id ? { ...i, ...patch, ...extra } : i)));
}

export function addToQueue(items: Omit<DailyItem, "id">[]) {
  const q = loadQueue();
  const have = new Set(q.map((i) => i.idea.toLowerCase()));
  const fresh = items
    .filter((i) => !have.has(i.idea.toLowerCase()))
    .map((i) => ({ ...i, id: crypto.randomUUID() }));
  saveQueue([...q, ...fresh]);
  return fresh;
}

export type StoredCheck = { at: string; total: number; flagged: number };

export function lastShopCheck(): StoredCheck | null {
  try {
    return JSON.parse(localStorage.getItem(CHECK_KEY) || "null") as StoredCheck | null;
  } catch {
    return null;
  }
}

export function storeShopCheck(c: StoredCheck) {
  localStorage.setItem(CHECK_KEY, JSON.stringify(c));
}

export const shopCheckDue = () => lastShopCheck()?.at !== today();
export { today as todayKey };

/** Words matched against Etsy's seller categories to pick one for a draft. */
export const TAXONOMY_WORDS: Record<string, string[]> = {
  crochet: ["patterns & how to", "crochet"],
  "pod-design": ["digital", "clip art"],
  "sticker-sheet": ["stickers"],
  "clipart-bundle": ["clip art"],
  "svg-cut-file": ["clip art", "digital"],
  "wall-art": ["digital prints"],
  "coloring-page": ["coloring"],
  "digital-paper": ["scrapbooking", "paper"],
  "tumbler-wrap": ["clip art", "digital"],
  "planner-page": ["calendars & planners"],
  "greeting-card": ["greeting cards"],
  "phone-wallpaper": ["digital prints"],
};
