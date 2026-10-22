import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  PROVIDER_LABEL,
  activeProvider,
  textProvider,
  useSettings,
  type AIProvider,
  type AdobeProvider,
  type Settings,
  type TextProvider,
} from "@/lib/settings-store";
import { Copy, Moon, Smartphone, Store, Sun } from "lucide-react";
import {
  etsyConnectLink,
  etsyConnected,
  finishEtsyConnectFromAddress,
  startEtsyConnect,
} from "@/lib/etsy/client";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Digital Product AI Automation" }] }),
  component: SettingsPage,
});

type KeyField = "claudeKey" | "geminiKey" | "openrouterKey" | "removeBgKey";

const KEYS: Array<{
  field: KeyField;
  label: string;
  placeholder: string;
  getUrl: string;
  getLabel: string;
  usedFor: string;
  /** Provider header used to test the key, when it can be tested with a text call. */
  check?: TextProvider;
}> = [
  {
    field: "claudeKey",
    label: "Anthropic Claude",
    placeholder: "sk-ant-...",
    getUrl: "https://console.anthropic.com/settings/keys",
    getLabel: "console.anthropic.com",
    usedFor:
      "Claude Opus 5.5, the strongest writer here: crochet patterns with correct stitch counts, the PDF text and Etsy SEO (title, 13 tags, description). It makes no images, so keep a Gemini or OpenRouter key for thumbnails and files. Prepaid credits, no free tier; a Claude.ai Pro or Max plan does not include API use.",
    check: "anthropic",
  },
  {
    field: "geminiKey",
    label: "Google Gemini",
    placeholder: "AIza...",
    getUrl: "https://aistudio.google.com/apikey",
    getLabel: "aistudio.google.com/apikey",
    usedFor:
      "Gemini 3 Pro Image, native 4K artwork. A free key covers SEO text and crochet patterns; designs and mockups need billing turned on for the key.",
    check: "gemini",
  },
  {
    field: "openrouterKey",
    label: "OpenRouter",
    placeholder: "sk-or-...",
    getUrl: "https://openrouter.ai/keys",
    getLabel: "openrouter.ai/keys",
    usedFor:
      "The same Gemini 3 Pro Image 4K model through one prepaid key. Handy if Gemini is not available in your country.",
    check: "openrouter",
  },
  {
    field: "removeBgKey",
    label: "remove.bg",
    placeholder: "Your remove.bg key",
    getUrl: "https://www.remove.bg/api",
    getLabel: "remove.bg/api",
    usedFor:
      "Optional. The cleanest transparent cut-outs (hair, soft edges). 50 free per month. Without it the app removes white backgrounds in your browser.",
  },
];

const PROVIDERS: Array<{ id: AIProvider; label: string; key: KeyField }> = [
  { id: "gemini", label: "Google Gemini", key: "geminiKey" },
  { id: "openrouter", label: "OpenRouter", key: "openrouterKey" },
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
          desc="Text and images can come from different AIs, so each job uses the best one."
        >
          <Label htmlFor="text-ai">Text: crochet patterns, PDF text and Etsy SEO</Label>
          <select
            id="text-ai"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={settings.textAi}
            onChange={(e) => update({ textAi: e.target.value as Settings["textAi"] })}
          >
            <option value="auto">Best available (Claude when its key is added)</option>
            <option value="anthropic">Claude Opus 5.5</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Writing now with{" "}
            <span className="font-medium text-foreground">
              {PROVIDER_LABEL[textProvider(settings)]}
            </span>
            .
            {!settings.claudeKey &&
              " Add a Claude key below for the best patterns and SEO; without one the image provider writes the text."}
          </p>

          <p className="mt-5 text-sm font-medium">Images: thumbnails, mockups and 4K files</p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
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
              {PROVIDERS.find((p) => p.id === settings.aiProvider)?.label} has no key, so the app
              will use {PROVIDERS.find((p) => p.id === using)?.label} instead.
            </p>
          )}
          {!settings[PROVIDERS.find((p) => p.id === using)!.key] && (
            <p className="mt-2 text-xs font-medium text-destructive">
              Add a key for {PROVIDERS.find((p) => p.id === using)?.label} below, otherwise
              generation shows “No AI key is set”.
            </p>
          )}

          <div className="mt-5">
            <Label htmlFor="iq">Image quality</Label>
            <select
              id="iq"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={settings.imageQuality}
              onChange={(e) => update({ imageQuality: e.target.value as Settings["imageQuality"] })}
            >
              <option value="4k">
                Best: native 4K designs (about $0.24) and 2K mockups (about $0.13 each)
              </option>
              <option value="fast">Fast and cheap: ~1K images upscaled (about $0.04 each)</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Best gives sharp listing photos at the 2000px Etsy asks for. Fast mode is fine for
              testing ideas.
            </p>
          </div>
        </Panel>

        <Panel
          title="API keys"
          desc="Add only the ones you use. Check sends a tiny text request (free on Gemini, a fraction of a cent on Claude)."
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
          title="Etsy shop"
          desc="Lets the app check your listings and save new products to Etsy as drafts. It never publishes anything."
        >
          <EtsyConnect settings={settings} update={update} />
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
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
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

function EtsyConnect({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const [origin, setOrigin] = useState("http://localhost:8080");
  useEffect(() => setOrigin(window.location.origin), []);
  const connected = etsyConnected(settings);
  const ready = !!(settings.etsyKeystring && settings.etsySecret);

  return (
    <div className="space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          Create an app at{" "}
          <a
            href="https://www.etsy.com/developers/register"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            etsy.com/developers/register
          </a>
          .
        </li>
        <li>
          Set its callback URL to the one picked here (both work, they must just match):
          <select
            className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs text-foreground"
            value={settings.etsyCallbackApi ? "api" : "page"}
            onChange={(e) => update({ etsyCallbackApi: e.target.value === "api" })}
            aria-label="Etsy callback URL"
          >
            <option value="page">{origin}/etsy/callback</option>
            <option value="api">{origin}/api/etsy/callback</option>
          </select>
        </li>
        <li>Paste the Keystring and Shared secret below, then press Connect Etsy.</li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="etsy-key">Keystring</Label>
          <Input
            id="etsy-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 font-mono"
            value={settings.etsyKeystring}
            onChange={(e) => update({ etsyKeystring: e.target.value.trim() })}
          />
        </div>
        <div>
          <Label htmlFor="etsy-secret">Shared secret</Label>
          <Input
            id="etsy-secret"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 font-mono"
            value={settings.etsySecret}
            onChange={(e) => update({ etsySecret: e.target.value.trim() })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => startEtsyConnect(settings)} disabled={!ready}>
          <Store className="h-4 w-4" /> {connected ? "Reconnect Etsy" : "Connect Etsy"}
        </Button>
        {connected && (
          <>
            <span className="text-sage">Connected to {settings.etsyShopName}</span>
            <Button
              variant="ghost"
              onClick={() =>
                update({
                  etsyAccess: "",
                  etsyRefresh: "",
                  etsyExpiresAt: 0,
                  etsyShopId: 0,
                  etsyShopName: "",
                })
              }
            >
              Disconnect
            </Button>
          </>
        )}
      </div>
      {ready && <PhoneConnect settings={settings} />}
    </div>
  );
}

/** For computers where etsy.com shows "Access is temporarily restricted": approve on a phone. */
function PhoneConnect({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function makeLink() {
    setErr(null);
    setAddress("");
    setLink(await etsyConnectLink(settings));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied. Send it to your phone.");
    } catch {
      toast.error("Could not copy. Select the link and copy it yourself.");
    }
  }

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      const s = await finishEtsyConnectFromAddress(address);
      toast.success(`Connected to ${s.etsyShopName}`);
      setOpen(false);
      setLink("");
      setAddress("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>
        Etsy says "Access is temporarily restricted" on this computer? Connect with your phone
        instead.
      </button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="flex items-center gap-2 font-medium">
        <Smartphone className="h-4 w-4" /> Connect with your phone
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>
          <Button size="sm" variant="outline" onClick={makeLink}>
            {link ? "Make a new link" : "Make the phone link"}
          </Button>
          {link && (
            <div className="mt-2 flex gap-2">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
                aria-label="Etsy link for your phone"
              />
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          )}
        </li>
        <li>
          Send the link to your phone (for example in WhatsApp to yourself) and open it in the
          phone's browser. Sign in to Etsy there and press <b>Allow access</b>.
        </li>
        <li>
          The phone then shows a page that cannot open. That is expected: the address points to this
          computer. Copy the whole address from the phone's address bar, send it back to this
          computer and paste it here within a few minutes.
        </li>
      </ol>
      <div className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="http://localhost:8080/etsy/callback?code=…"
          className="font-mono text-xs"
          aria-label="Address from your phone"
        />
        <Button size="sm" onClick={finish} disabled={!address.trim() || busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Finish connecting
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
