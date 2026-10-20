import { useEffect, useState } from "react";

/**
 * One place for every API key and AI preference, shared by the product generator, Crochet,
 * Adobe Stock and the /settings page. Stored in this browser's localStorage only.
 */

export type AIProvider = "lovable" | "openai" | "gemini" | "openrouter";
export type AdobeProvider = "gemini" | "openai" | "xai";

export type Settings = {
  aiProvider: AIProvider;
  lovableKey: string;
  openaiKey: string;
  geminiKey: string;
  openrouterKey: string;
  xaiKey: string;
  removeBgKey: string;
  /** "4k": native 4K pro image; "fast": cheaper ~1K flash image upscaled to 4096px. */
  imageQuality: "4k" | "fast";
  /** Image provider for Adobe Stock Studio. */
  adobeProvider: AdobeProvider;
};

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "lovable",
  lovableKey: "",
  openaiKey: "",
  geminiKey: "",
  openrouterKey: "",
  xaiKey: "",
  removeBgKey: "",
  imageQuality: "4k",
  adobeProvider: "gemini",
};

const STORAGE_KEY = "etsyforge:settings";
const CHANGE_EVENT = "etsyforge:settings-changed";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  let s: Settings = DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // Adobe Stock used to keep its own keys; fold them in once so nothing is lost.
    const legacy = {
      gemini: localStorage.getItem("as_gemini_key") || "",
      openai: localStorage.getItem("as_openai_key") || "",
      xai: localStorage.getItem("as_xai_key") || "",
      provider: localStorage.getItem("as_provider") as AdobeProvider | null,
    };
    if (legacy.gemini || legacy.openai || legacy.xai || legacy.provider) {
      s = {
        ...s,
        geminiKey: s.geminiKey || legacy.gemini,
        openaiKey: s.openaiKey || legacy.openai,
        xaiKey: s.xaiKey || legacy.xai,
        adobeProvider: legacy.provider || s.adobeProvider,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      for (const k of ["as_gemini_key", "as_openai_key", "as_xai_key", "as_provider"])
        localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
  return s;
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

/**
 * The Default AI gateway only has a key when the app runs on Lovable hosting. When the user
 * kept it selected but entered a key for another provider, use that provider instead.
 */
export function activeProvider(s: Settings): AIProvider {
  if (s.aiProvider !== "lovable" || s.lovableKey) return s.aiProvider;
  if (s.geminiKey) return "gemini";
  if (s.openaiKey) return "openai";
  if (s.openrouterKey) return "openrouter";
  return "lovable";
}

export function keyFor(s: Settings, p: AIProvider | AdobeProvider): string {
  if (p === "gemini") return s.geminiKey;
  if (p === "openai") return s.openaiKey;
  if (p === "openrouter") return s.openrouterKey;
  if (p === "xai") return s.xaiKey;
  return s.lovableKey;
}

/** True when the user entered a key for the provider that will be used. */
export function hasAiKey(s: Settings): boolean {
  return !!keyFor(s, activeProvider(s));
}
