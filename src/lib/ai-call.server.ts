import Anthropic from "@anthropic-ai/sdk";
import {
  geminiModel,
  geminiTextCandidates,
  rememberWorkingModel,
  replacementFromError,
} from "@/lib/gemini-models.server";
// Server-only AI dispatcher: routes calls to the default gateway, OpenAI, Google Gemini, OpenRouter
// or Anthropic Claude (text only).
// The client sends `x-ai-provider` and `x-ai-key` headers; this module picks the right endpoint + body shape.
// Text routes also read `x-text-provider` and `x-text-key`, so Claude can write while Gemini draws.

export type Provider = "lovable" | "openai" | "gemini" | "openrouter" | "xai" | "anthropic";

const PROVIDERS: Provider[] = ["openai", "gemini", "openrouter", "lovable", "xai", "anthropic"];

const envKey = (p: Provider) =>
  ({
    lovable: process.env.LOVABLE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    xai: process.env.XAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  })[p];

export function resolveProvider(request: Request): { provider: Provider; key: string | undefined } {
  const headerProvider = (request.headers.get("x-ai-provider") || "").toLowerCase().trim();
  const headerKey = request.headers.get("x-ai-key")?.trim();
  // Legacy header for backwards compat with old settings
  const legacyKey = request.headers.get("x-lovable-key")?.trim();

  let provider: Provider = "lovable";
  if ((PROVIDERS as string[]).includes(headerProvider)) {
    provider = headerProvider as Provider;
  }

  // Fall back to server env for the chosen provider
  const key = headerKey || legacyKey || envKey(provider);
  return { provider, key };
}

/** Provider for text-only routes (patterns, SEO, ideas): the text headers when sent, else the image ones. */
export function resolveTextProvider(request: Request): {
  provider: Provider;
  key: string | undefined;
} {
  const p = (request.headers.get("x-text-provider") || "").toLowerCase().trim() as Provider;
  if (!PROVIDERS.includes(p)) return resolveProvider(request);
  return { provider: p, key: request.headers.get("x-text-key")?.trim() || envKey(p) };
}

export type TextOpts = {
  provider: Provider;
  key: string;
  system?: string;
  user: string;
  json?: boolean;
  /** "fast" = cheapest, "pro" = highest quality (default fast). */
  tier?: "fast" | "pro";
  /** Max output tokens (default 8192 to avoid truncated JSON). */
  maxTokens?: number;
  /** Let the model search the web first (Claude web search, Google Search, OpenRouter :online). */
  webSearch?: boolean;
};

/** Returns the assistant text content (or JSON string if json=true). Retries transient 429/500/503/524. */
export async function callText(opts: TextOpts): Promise<string> {
  const { provider, key, system, user, json, tier = "fast", maxTokens = 8192, webSearch } = opts;

  const delays = [1500, 4000, 9000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      if (provider === "anthropic")
        return await claudeText({ key, system, user, json, tier, maxTokens, webSearch });

      if (provider === "gemini") {
        const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens };
        // Google Search grounding does not combine with the JSON response type.
        if (json && !webSearch) generationConfig.responseMimeType = "application/json";
        const body: Record<string, unknown> = {
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig,
        };
        if (webSearch) body.tools = [{ google_search: {} }];
        if (system) body.systemInstruction = { parts: [{ text: system }] };
        const send = (model: string) =>
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
        const queue = await geminiTextCandidates(key, tier);
        let res: Response | null = null;
        let quotaErr: Error | null = null;
        for (let i = 0; i < queue.length && i < 6; i++) {
          const model = queue[i];
          res = await send(model);
          if (res.ok) {
            rememberWorkingModel(key, tier, model);
            break;
          }
          const err = await httpErr(res, "Gemini text");
          if (res.status === 404) {
            // Retired model: Google's error names the replacement.
            const next = replacementFromError(err.message);
            if (next && !queue.includes(next)) queue.splice(i + 1, 0, next);
            res = null;
            continue;
          }
          if (res.status === 429 && /quota/i.test(err.message)) {
            // This model's free quota is used up; each model has its own, so try the next one.
            quotaErr = err;
            res = null;
            continue;
          }
          throw err;
        }
        if (!res) {
          if (quotaErr) {
            const e = new Error(
              `Gemini free quota is used up on every model this key can use (tried ${queue.slice(0, 6).join(", ")}). Free limits reset daily, or turn on billing for the key at aistudio.google.com. (raw: ${quotaErr.message.slice(0, 200)})`,
            ) as Error & { status?: number; noRetry?: boolean };
            e.status = 429;
            e.noRetry = true;
            throw e;
          }
          throw new Error("No Gemini text model is available for this key.");
        }
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
        if (!text) throw new Error("Gemini returned empty response");
        return json && webSearch ? jsonPart(text) : text;
      }

      const cfg = openAiCompatConfig(provider);
      const baseModel =
        provider === "openai"
          ? "gpt-4o-mini"
          : provider === "openrouter"
            ? "google/gemini-2.5-flash"
            : provider === "xai"
              ? "grok-2-1212"
              : "google/gemini-2.5-flash";
      // OpenRouter adds web results to any model with the ":online" suffix.
      const model = webSearch && provider === "openrouter" ? `${baseModel}:online` : baseModel;
      const messages: { role: string; content: string }[] = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: user });
      const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
      if (json) body.response_format = { type: "json_object" };
      const res = await fetch(`${cfg.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...cfg.extraHeaders,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await httpErr(res, `${provider} text`);
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = j.choices?.[0]?.message?.content ?? "";
      if (!content) throw new Error(`${provider} returned empty content`);
      return json && webSearch ? jsonPart(content) : content;
    } catch (e) {
      lastErr = e as Error;
      const status = (e as Error & { status?: number }).status;
      const retriable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        status === 524;
      if (!retriable || attempt >= delays.length || (e as { noRetry?: boolean }).noRetry) throw e;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr ?? new Error("callText failed");
}

/** Claude has no image model, so it only ever writes text. */
const CLAUDE_MODEL = "claude-opus-5-5";

async function claudeText(o: {
  key: string;
  system?: string;
  user: string;
  json?: boolean;
  tier: "fast" | "pro";
  maxTokens: number;
  webSearch?: boolean;
}): Promise<string> {
  // The SDK already retries rate limits and overloads with backoff, so callText must not repeat it.
  const client = new Anthropic({ apiKey: o.key, maxRetries: 3 });
  const system = o.json
    ? `${o.system ?? ""}\n\nReply with only the JSON object: no code fences and no other text.`.trim()
    : o.system;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: o.user }];
  let msg: Anthropic.Beta.BetaMessage;
  try {
    // A long web search can pause the turn; sending it back as is lets the server carry on.
    for (let turn = 0; ; turn++) {
      // Streamed so long patterns never hit the request timeout.
      msg = await client.beta.messages
        .stream({
          model: CLAUDE_MODEL,
          // Claude always thinks first and that counts toward max_tokens, so leave room for it.
          max_tokens: o.maxTokens + (o.tier === "pro" ? 24000 : 8000),
          // "high" where every stitch count must add up, Opus 5.5's own default elsewhere.
          output_config: { effort: o.tier === "pro" ? "high" : "medium" },
          ...(system ? { system } : {}),
          messages,
          ...(o.webSearch
            ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] }
            : {}),
          // If a safety check wrongly declines, Anthropic re-runs the request on its recommended model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        })
        .finalMessage();
      if (msg.stop_reason !== "pause_turn" || turn >= 3) break;
      messages.push({ role: "assistant", content: msg.content });
    }
  } catch (e) {
    throw claudeError(e);
  }
  if (msg.stop_reason === "refusal")
    throw withStatus(
      new Error("Claude declined to write this one. Reword the idea and try again."),
      422,
    );
  if (msg.stop_reason === "max_tokens")
    throw withStatus(new Error("Claude's answer was cut off before it finished. Try again."), 502);
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!text) throw withStatus(new Error("Claude returned an empty answer."), 502);
  return o.json ? jsonPart(text) : text;
}

function withStatus(e: Error, status: number) {
  return Object.assign(e, { status, noRetry: true });
}

function claudeError(e: unknown): Error {
  if (e instanceof Anthropic.APIError) {
    // The body is { error: { type, message } }; its message reads better than the SDK's summary.
    const detail = (e.error as { error?: { message?: string } } | undefined)?.error?.message;
    const text =
      e instanceof Anthropic.AuthenticationError
        ? "Claude rejected this API key. Copy it again from console.anthropic.com."
        : e instanceof Anthropic.RateLimitError
          ? `Claude rate limit reached, try again in a minute. (${detail ?? e.message})`
          : `Claude: ${detail ?? e.message}`;
    return withStatus(new Error(text), e.status ?? 500);
  }
  return withStatus(e instanceof Error ? e : new Error(String(e)), 500);
}

/** The JSON part of a reply, in case it comes wrapped in a code fence or a sentence. */
function jsonPart(text: string): string {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

export type ImageOpts = {
  provider: Provider;
  key: string;
  prompt: string;
  /** Optional input image (base64 PNG, no data: prefix) — for edits/mockups */
  inputImageB64?: string;
  /** Gemini aspect ratio hint: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "4:5" | "5:4" */
  aspectRatio?: string;
  /** When true, use gemini-3-pro-image-preview (higher fidelity, larger native output). */
  hires?: boolean;
  /** Native output size for hi-res Gemini models (ignored by models that only do ~1K). */
  imageSize?: "1K" | "2K" | "4K";
};

/** Returns the generated image as base64 PNG (no data: prefix). */
export async function callImage(opts: ImageOpts): Promise<string> {
  const { provider, key, prompt, inputImageB64, aspectRatio, hires } = opts;
  const { imageSize } = opts;

  if (provider === "openai") {
    // OpenAI image generation (text-to-image) or edits (image-to-image)
    if (inputImageB64) {
      // Use /v1/images/edits with multipart
      const form = new FormData();
      const bin = Uint8Array.from(atob(inputImageB64), (c) => c.charCodeAt(0));
      form.append("image", new Blob([bin], { type: "image/png" }), "input.png");
      form.append("prompt", prompt);
      form.append("model", "gpt-image-1");
      form.append("size", pickOpenAiSize(aspectRatio));
      form.append("quality", "high");
      // Keep the provided artwork faithful (colors, linework, text) when compositing mockups.
      form.append("input_fidelity", "high");
      form.append("n", "1");
      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) throw await httpErr(res, "OpenAI image edit");
      const j = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI returned no image");
      return b64;
    }
    // Map aspect ratio → OpenAI-supported size. gpt-image-1 supports 1024x1024, 1536x1024, 1024x1536.
    const oaSize = pickOpenAiSize(aspectRatio);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: oaSize, quality: "high", n: 1 }),
    });
    if (!res.ok) throw await httpErr(res, "OpenAI image");
    const j = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image");
    return b64;
  }

  if (provider === "xai") {
    // xAI Grok image (grok-2-image-1212) — OpenAI-compatible endpoint. Fixed ~1024x768 output.
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-2-image-1212",
        prompt,
        response_format: "b64_json",
        n: 1,
      }),
    });
    if (!res.ok) throw await httpErr(res, "xAI Grok image");
    const j = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = j.data?.[0];
    if (item?.b64_json) return item.b64_json;
    if (item?.url) {
      const img = await fetch(item.url);
      const buf = new Uint8Array(await img.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return btoa(bin);
    }
    throw new Error("xAI Grok returned no image");
  }

  if (provider === "gemini") {
    // Hires uses Gemini 3 Pro Image (Nano Banana 2) — highest native fidelity.
    // Falls back to gemini-2.5-flash-image if the pro model is overloaded.
    const fastModel = await geminiModel(key, "imageFast", "gemini-2.5-flash-image");
    const primary = hires
      ? await geminiModel(key, "imagePro", "gemini-3-pro-image-preview")
      : fastModel;
    try {
      return await geminiImageWithRetry(
        primary,
        key,
        prompt,
        inputImageB64,
        aspectRatio,
        hires ? imageSize : undefined,
      );
    } catch (e) {
      const msg = (e as Error).message || "";
      const isRegionBlock = /User location is not supported|FAILED_PRECONDITION|\b400\b/.test(msg);
      if (isRegionBlock) {
        // Direct Gemini API is geo-restricted for this user. Fall back to the
        // Lovable AI gateway (or OpenRouter) which proxies Gemini image without region blocks.
        const fallbackKey = process.env.LOVABLE_API_KEY || process.env.OPENROUTER_API_KEY;
        const fallbackProvider: Provider = process.env.LOVABLE_API_KEY ? "lovable" : "openrouter";
        if (fallbackKey) {
          return await callImage({
            provider: fallbackProvider,
            key: fallbackKey,
            prompt,
            inputImageB64,
            aspectRatio,
            hires,
            imageSize,
          });
        }
        throw new Error(
          "Gemini image API is not available in your region. Add a Default gateway key (LOVABLE_API_KEY) or OpenRouter key in Settings to use the proxied route.",
        );
      }
      if (hires) return geminiImageWithRetry(fastModel, key, prompt, inputImageB64, aspectRatio);
      throw e;
    }
  }

  // Default + OpenRouter: OpenAI-compatible chat completions with Gemini image model.
  // Hi-res requests use Gemini 3 Pro Image and fall back to Flash Image if it is unavailable.
  if (hires) {
    try {
      return await chatCompletionsImage(
        provider,
        key,
        "google/gemini-3-pro-image-preview",
        prompt,
        inputImageB64,
        aspectRatio,
        imageSize,
      );
    } catch (e) {
      const s = statusFromError(e);
      if (s === 401 || s === 402 || s === 429) throw e;
    }
  }
  return chatCompletionsImage(
    provider,
    key,
    "google/gemini-2.5-flash-image",
    prompt,
    inputImageB64,
    aspectRatio,
  );
}

async function chatCompletionsImage(
  provider: Provider,
  key: string,
  model: string,
  prompt: string,
  inputImageB64?: string,
  aspectRatio?: string,
  imageSize?: string,
): Promise<string> {
  const cfg = openAiCompatConfig(provider);
  const userContent: unknown = inputImageB64
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/png;base64,${inputImageB64}` } },
      ]
    : prompt;

  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...cfg.extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: userContent }],
      modalities: ["image", "text"],
      // OpenRouter forwards these to Gemini; the default gateway does not document them.
      ...(provider === "openrouter" && (aspectRatio || imageSize)
        ? {
            image_config: {
              ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
              ...(imageSize ? { image_size: imageSize } : {}),
            },
          }
        : {}),
    }),
  });
  if (!res.ok) throw await httpErr(res, `${provider} image`);
  const j = (await res.json()) as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[]; content?: unknown } }[];
  };
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`${provider} returned no image`);
  return url.startsWith("data:") ? url.split(",")[1] : url;
}

function openAiCompatConfig(provider: Provider): {
  baseURL: string;
  extraHeaders: Record<string, string>;
} {
  if (provider === "openrouter") {
    return {
      baseURL: "https://openrouter.ai/api/v1",
      extraHeaders: { "HTTP-Referer": "https://etsyforge.app", "X-Title": "EtsyForge" },
    };
  }
  if (provider === "openai") {
    return { baseURL: "https://api.openai.com/v1", extraHeaders: {} };
  }
  if (provider === "xai") {
    return { baseURL: "https://api.x.ai/v1", extraHeaders: {} };
  }
  // default gateway
  return { baseURL: "https://ai.gateway.lovable.dev/v1", extraHeaders: {} };
}

/** Map a generic aspect ratio (e.g. "16:9", "9:16") to an OpenAI gpt-image-1 supported size. */
function pickOpenAiSize(aspect?: string): "1024x1024" | "1536x1024" | "1024x1536" {
  if (!aspect) return "1024x1024";
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return "1024x1024";
  const r = w / h;
  if (r > 1.15) return "1536x1024";
  if (r < 0.87) return "1024x1536";
  return "1024x1024";
}

async function httpErr(res: Response, label: string): Promise<Error> {
  const text = await res.text().catch(() => "");
  const e = new Error(`${label} ${res.status}: ${text.slice(0, 300)}`);
  (e as Error & { status?: number }).status = res.status;
  return e;
}

async function callImageFallbackGemini(
  key: string,
  prompt: string,
  inputImageB64?: string,
): Promise<string> {
  const model = await geminiModel(key, "imageFast", "gemini-2.5-flash-image");
  return geminiImageWithRetry(model, key, prompt, inputImageB64, undefined);
}

async function geminiImageWithRetry(
  model: string,
  key: string,
  prompt: string,
  inputImageB64?: string,
  aspectRatio?: string,
  imageSize?: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (inputImageB64) parts.push({ inlineData: { mimeType: "image/png", data: inputImageB64 } });
  const generationConfig: Record<string, unknown> = { responseModalities: ["IMAGE", "TEXT"] };
  if (aspectRatio || imageSize) {
    generationConfig.imageConfig = {
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(imageSize ? { imageSize } : {}),
    };
  }
  const body = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig });

  let lastErr: Error | null = null;
  const delays = [1500, 4000, 9000, 15000]; // total ~30s of waiting
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) {
      const j = (await res.json()) as {
        candidates?: {
          content?: {
            parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[];
          };
        }[];
      };
      for (const p of j.candidates?.[0]?.content?.parts ?? []) {
        const data = p.inlineData?.data ?? p.inline_data?.data;
        if (data) return data;
      }
      throw new Error("Gemini returned no image");
    }
    if (![429, 500, 502, 503, 504, 524].includes(res.status)) {
      throw await httpErr(res, "Gemini image");
    }
    lastErr = await httpErr(res, "Gemini image");
    if (attempt < delays.length) await new Promise((r) => setTimeout(r, delays[attempt]));
  }
  throw lastErr ?? new Error("Gemini image failed after retries");
}

export function statusFromError(err: unknown): number {
  const s = (err as { status?: number } | undefined)?.status;
  if (s === 401 || s === 403) return 401;
  if (s === 402) return 402;
  if (s === 429) return 429;
  return 500;
}
