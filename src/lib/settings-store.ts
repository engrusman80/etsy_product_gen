import { useEffect, useState } from "react";

/**
 * One place for every API key and AI preference, shared by the product generator, Crochet,
 * Adobe Stock and the /settings page. Stored in this browser's localStorage only.
 */

/**
 * Only providers that render native 4K artwork (Gemini 3 Pro Image) are offered. OpenAI tops out
 * at 1536px and Grok at ~1K, so they were removed.
 */
export type AIProvider = "gemini" | "openrouter";
export type AdobeProvider = AIProvider;

export type Settings = {
  aiProvider: AIProvider;
  geminiKey: string;
  openrouterKey: string;
  removeBgKey: string;
  /** "4k": native 4K pro image; "fast": cheaper ~1K flash image upscaled to 4096px. */
  imageQuality: "4k" | "fast";
  /** Image provider for Adobe Stock Studio. */
  adobeProvider: AdobeProvider;
};

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "gemini",
  geminiKey: "",
  openrouterKey: "",
  removeBgKey: "",
  imageQuality: "4k",
  adobeProvider: "gemini",
};

const isProvider = (v: unknown): v is AIProvider => v === "gemini" || v === "openrouter";

/** Keep only known fields, so keys for removed providers are dropped from storage. */
function clean(raw: Partial<Record<keyof Settings, unknown>>): Settings {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    aiProvider: isProvider(raw.aiProvider) ? raw.aiProvider : "gemini",
    geminiKey: str(raw.geminiKey),
    openrouterKey: str(raw.openrouterKey),
    removeBgKey: str(raw.removeBgKey),
    imageQuality: raw.imageQuality === "fast" ? "fast" : "4k",
    adobeProvider: isProvider(raw.adobeProvider) ? raw.adobeProvider : "gemini",
  };
}

const STORAGE_KEY = "etsyforge:settings";
const CHANGE_EVENT = "etsyforge:settings-changed";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    // Adobe Stock used to keep its own keys; fold the Gemini one in once.
    const legacyGemini = localStorage.getItem("as_gemini_key") || "";
    if (legacyGemini && !stored.geminiKey) stored.geminiKey = legacyGemini;
    const s = clean(stored);
    const legacy = ["as_gemini_key", "as_openai_key", "as_xai_key", "as_provider"];
    if (raw !== JSON.stringify(s) && (raw || legacy.some((k) => localStorage.getItem(k)))) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
    for (const k of legacy) localStorage.removeItem(k);
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Current settings, kept in sync across pages and browser tabs. */
export function useSettings(): [Settings, (s: Settings) => void] {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const sync = () => setS(loadSettings());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return [s, saveSettings];
}

/** The chosen provider, or the other one when only that one has a key. */
export function activeProvider(s: Settings): AIProvider {
  if (keyFor(s, s.aiProvider)) return s.aiProvider;
  if (s.geminiKey) return "gemini";
  if (s.openrouterKey) return "openrouter";
  return s.aiProvider;
}

export function keyFor(s: Settings, p: AIProvider): string {
  return p === "gemini" ? s.geminiKey : s.openrouterKey;
}

/** True when the user entered a key for the provider that will be used. */
export function hasAiKey(s: Settings): boolean {
  return !!keyFor(s, activeProvider(s));
}
