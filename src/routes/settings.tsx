import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";
import {
  DEFAULT_SETTINGS,
  activeProvider,
  useSettings,
  type AIProvider,
  type AdobeProvider,
  type Settings,
} from "@/lib/settings-store";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Digital Product AI Automation" }] }),
  component: SettingsPage,
});

type KeyField =
  | "geminiKey"
  | "openaiKey"
  | "openrouterKey"
  | "xaiKey"
  | "removeBgKey"
  | "lovableKey";

const KEYS: Array<{
  field: KeyField;
  label: string;
  placeholder: string;
  getUrl: string;
  getLabel: string;
  usedFor: string;
  /** Provider header used to test the key, when it can be tested with a text call. */
  check?: AIProvider | "xai";
}> = [
  {
    field: "geminiKey",
    label: "Google Gemini",
    placeholder: "AIza...",
    getUrl: "https://aistudio.google.com/apikey",
    getLabel: "aistudio.google.com/apikey",
    usedFor:
      "Free key works for SEO text, crochet patterns and keyword ideas. Designs and mockups need billing turned on for the key.",
    check: "gemini",
  },
  {
    field: "openaiKey",
    label: "OpenAI",
    placeholder: "sk-...",
    getUrl: "https://platform.openai.com/api-keys",
    getLabel: "platform.openai.com/api-keys",
    usedFor: "Pay-per-use. Text plus gpt-image-1 designs and mockups (max 1536px).",
    check: "openai",
  },
  {
    field: "openrouterKey",
    label: "OpenRouter",
    placeholder: "sk-or-...",
    getUrl: "https://openrouter.ai/keys",
    getLabel: "openrouter.ai/keys",
    usedFor: "One prepaid key for Gemini 4K images and many text models.",
    check: "openrouter",
  },
  {
    field: "xaiKey",
    label: "xAI Grok",
    placeholder: "xai-...",
    getUrl: "https://console.x.ai",
    getLabel: "console.x.ai",
    usedFor: "Optional image provider in Adobe Stock Studio.",
    check: "xai",
  },
  {
    field: "removeBgKey",
    label: "remove.bg",
    placeholder: "Your remove.bg key",
    getUrl: "https://www.remove.bg/api",
    getLabel: "remove.bg/api",
    usedFor:
      "Optional. Cleaner background removal (50 free per month). Without it the app removes white backgrounds in your browser.",
  },
  {
    field: "lovableKey",
    label: "Default AI gateway (Lovable)",
    placeholder: "Only on Lovable hosting",
    getUrl: "https://lovable.dev",
    getLabel: "lovable.dev",
    usedFor: "Only needed when the app is hosted on Lovable. Leave empty on your own computer.",
    check: "lovable",
  },
];

const PROVIDERS: Array<{ id: AIProvider; label: string; key: KeyField }> = [
  { id: "gemini", label: "Google Gemini", key: "geminiKey" },
  { id: "openai", label: "OpenAI", key: "openaiKey" },
  { id: "openrouter", label: "OpenRouter", key: "openrouterKey" },
  { id: "lovable", label: "Default AI (Lovable hosting)", key: "lovableKey" },
];

function SettingsPage() {
  const [settings, save] = useSettings();
  const { theme, toggle } = useTheme();

  // Every change is saved straight away, so there is no Save button to forget.
  const update = (patch: Partial<Settings>) => save({ ...settings, ...patch });
  const using = activeProvider(settings);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        active="settings"
        actions={
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        }
      />
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Settings</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            API keys and AI options
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            One place for every key the app uses: product generator, crochet patterns and Adobe
            Stock. Changes save automatically.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            Keys stay in this browser only. They are sent to the AI provider with each request and
            never stored on a server.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <Panel
          title="AI provider"
          desc="Used by the product generator and crochet studio for text and images."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const on = settings.aiProvider === p.id;
              const hasKey = !!settings[p.key];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update({ aiProvider: p.id })}
                  aria-pressed={on}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    on
                      ? "border-primary bg-accent ring-1 ring-primary"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className={`text-xs ${hasKey ? "text-sage" : "text-muted-foreground"}`}>
                    {hasKey ? "key added" : "no key"}
                  </span>
                </button>
              );
            })}
          </div>
          {using !== settings.aiProvider && (
            <p className="mt-2 text-xs text-muted-foreground">
              Default AI has no key here, so the app will use{" "}
              {PROVIDERS.find((p) => p.id === using)?.label} instead.
            </p>
          )}
          {!settings[PROVIDERS.find((p) => p.id === using)!.key] && (
            <p className="mt-2 text-xs font-medium text-destructive">
              Add a key for {PROVIDERS.find((p) => p.id === using)?.label} below, otherwise
              generation shows “No AI key is set”.
            </p>
          )}

          <div className="mt-5">
            <Label htmlFor="iq">Design image quality</Label>
            <select
              id="iq"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={settings.imageQuality}
              onChange={(e) => update({ imageQuality: e.target.value as Settings["imageQuality"] })}
            >
              <option value="4k">Native 4K (best for prints, about $0.24 per design)</option>
              <option value="fast">Fast and cheap (~1K upscaled to 4K, about $0.04)</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Fast mode is fine for stickers, wallpapers and testing ideas. Use native 4K for wall
              art and large prints. OpenAI has one quality level.
            </p>
          </div>
        </Panel>

        <Panel
          title="API keys"
          desc="Add only the ones you use. Each key is checked with a tiny free text request."
        >
          <div className="divide-y divide-border">
            {KEYS.map((k) => (
              <KeyRow
                key={k.field}
                spec={k}
                value={settings[k.field]}
                onChange={(v) => update({ [k.field]: v.trim() } as Partial<Settings>)}
              />
            ))}
          </div>
        </Panel>

        <Panel
          title="Adobe Stock Studio"
          desc="Which image provider Adobe Stock uses. It reads the keys above."
        >
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={settings.adobeProvider}
            onChange={(e) => update({ adobeProvider: e.target.value as AdobeProvider })}
            aria-label="Adobe Stock image provider"
          >
            <option value="gemini">Google Gemini (cheapest)</option>
            <option value="openai">OpenAI gpt-image-1 (most photorealistic)</option>
            <option value="xai">xAI Grok 2 Image</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Video generation always uses the Gemini key.
          </p>
        </Panel>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              save(DEFAULT_SETTINGS);
              toast.success("All keys and options cleared.");
            }}
          >
            <Trash2 className="h-4 w-4" /> Clear all keys
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Panel({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="paper-card p-6 sm:p-7">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KeyRow({
  spec,
  value,
  onChange,
}: {
  spec: (typeof KEYS)[number];
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [msg, setMsg] = useState("");
  const id = `key-${spec.field}`;

  async function check() {
    if (!spec.check || !value) return;
    setState("checking");
    setMsg("");
    try {
      const r = await fetch("/api/check-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Provider": spec.check,
          "X-AI-Key": value,
        },
        body: "{}",
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setState(j.ok ? "ok" : "bad");
      setMsg(j.ok ? "Key works." : j.error || "Key check failed.");
    } catch (e) {
      setState("bad");
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> {spec.label}
        </Label>
        <span className={`text-xs ${value ? "text-sage" : "text-muted-foreground"}`}>
          {value ? "Saved" : "Not set"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {spec.usedFor} Get one at{" "}
        <a href={spec.getUrl} target="_blank" rel="noreferrer" className="underline">
          {spec.getLabel}
        </a>
        .
      </p>
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={spec.placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setState("idle");
            }}
            className="pr-10 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide key" : "Show key"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {spec.check && (
          <Button variant="outline" onClick={check} disabled={!value || state === "checking"}>
            {state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
          </Button>
        )}
        {value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            aria-label={`Remove ${spec.label} key`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {state !== "idle" && state !== "checking" && (
        <p
          className={`mt-1.5 flex items-center gap-1 text-xs ${state === "ok" ? "text-sage" : "text-destructive"}`}
        >
          {state === "ok" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {msg}
        </p>
      )}
    </div>
  );
}
