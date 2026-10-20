import { geminiModel, replacementFromError } from "@/lib/gemini-models.server";
// Server-only AI dispatcher: routes calls to the default gateway, OpenAI, Google Gemini, or OpenRouter.
// The client sends `x-ai-provider` and `x-ai-key` headers; this module picks the right endpoint + body shape.

export type Provider = "lovable" | "openai" | "gemini" | "openrouter" | "xai";

export function resolveProvider(request: Request): { provider: Provider; key: string | undefined } {
  const headerProvider = (request.headers.get("x-ai-provider") || "").toLowerCase().trim();
  const headerKey = request.headers.get("x-ai-key")?.trim();
  // Legacy header for backwards compat with old settings
  const legacyKey = request.headers.get("x-lovable-key")?.trim();

  let provider: Provider = "lovable";
  if (["openai", "gemini", "openrouter", "lovable", "xai"].includes(headerProvider)) {
    provider = headerProvider as Provider;
  }

  let key = headerKey || legacyKey || undefined;
  if (!key) {
    // Fall back to server env for the chosen provider
    if (provider === "lovable") key = process.env.LOVABLE_API_KEY;
    else if (provider === "openai") key = process.env.OPENAI_API_KEY;
    else if (provider === "gemini") key = process.env.GEMINI_API_KEY;
    else if (provider === "openrouter") key = process.env.OPENROUTER_API_KEY;
    else if (provider === "xai") key = process.env.XAI_API_KEY;
  }
  return { provider, key };
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
};

/** Returns the assistant text content (or JSON string if json=true). Retries transient 429/500/503/524. */
export async function callText(opts: TextOpts): Promise<string> {
  const { provider, key, system, user, json, tier = "fast", maxTokens = 8192 } = opts;

  const delays = [1500, 4000, 9000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      if (provider === "gemini") {
        let model =
          tier === "pro"
            ? await geminiModel(key, "textPro", "gemini-2.5-pro")
            : await geminiModel(key, "text", "gemini-2.5-flash");
        const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens };
        if (json) generationConfig.responseMimeType = "application/json";
        const body: Record<string, unknown> = {
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig,
        };
        if (system) body.systemInstruction = { parts: [{ text: system }] };
        const send = () =>
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
        let res = await send();
        if (res.status === 404) {
          // Retired model: Google's error names the replacement, so retry once with it.
          const err = await httpErr(res, "Gemini text");
          const next = replacementFromError(err.message);
          if (!next || next === model) throw err;
          model = next;
          res = await send();
        }
        if (!res.ok) throw await httpErr(res, "Gemini text");
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
        if (!text) throw new Error("Gemini returned empty response");
        return text;
      }

      const cfg = openAiCompatConfig(provider);
      const model =
        provider === "openai"
          ? "gpt-4o-mini"
          : provider === "openrouter"
            ? "google/gemini-2.5-flash"
            : provider === "xai"
              ? "grok-2-1212"
              : "google/gemini-2.5-flash";
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
      return content;
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
      if (!retriable || attempt >= delays.length) throw e;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr ?? new Error("callText failed");
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
