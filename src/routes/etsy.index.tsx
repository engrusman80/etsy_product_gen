import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ExternalLink,
  Loader2,
  Moon,
  RefreshCw,
  Store,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";
import { useSettings } from "@/lib/settings-store";
import { PRODUCT_TYPES } from "@/lib/product-types";
import {
  etsyCall,
  etsyConnected,
  loadQueue,
  saveQueue,
  storeShopCheck,
  todayKey,
  shopCheckDue,
  lastShopCheck,
  type DailyItem,
} from "@/lib/etsy/client";
import { checkShop, type ListingLike, type ListingReport } from "@/lib/etsy/check";

export const Route = createFileRoute("/etsy/")({
  head: () => ({ meta: [{ title: "My Etsy shop · Digital Product AI Automation" }] }),
  component: EtsyPage,
});

const KINDS = [
  { id: "crochet", label: "Crochet pattern (PDF)" },
  ...PRODUCT_TYPES.map((t) => ({ id: t.id, label: t.label })),
];
const kindLabel = (id: string) => KINDS.find((k) => k.id === id)?.label ?? id;

function EtsyPage() {
  const [settings, save] = useSettings();
  const { theme, toggle } = useTheme();
  const connected = etsyConnected(settings);

  const [checking, setChecking] = useState(false);
  const [reports, setReports] = useState<ListingReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState<number | null>(null);

  const [queue, setQueue] = useState<DailyItem[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [newKind, setNewKind] = useState("crochet");

  useEffect(() => setQueue(loadQueue()), []);
  const updateQueue = (q: DailyItem[]) => {
    setQueue(q);
    saveQueue(q);
  };

  async function runCheck() {
    setChecking(true);
    try {
      const { listings } = await etsyCall<{ listings: ListingLike[] }>({ action: "listings" });
      const r = checkShop(listings, settings.etsyShopName);
      setReports(r);
      setTotal(listings.length);
      setApplied(new Set());
      storeShopCheck({ at: todayKey(), total: listings.length, flagged: r.length });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  // The daily check runs the first time this page or the generator opens each day.
  useEffect(() => {
    if (connected && shopCheckDue()) void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function applyFix(r: ListingReport) {
    if (!r.fix) return;
    setApplying(r.listing.listing_id);
    try {
      await etsyCall({ action: "update", listingId: r.listing.listing_id, fields: r.fix });
      setApplied((s) => new Set(s).add(r.listing.listing_id));
      toast.success("Listing updated on Etsy.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(null);
    }
  }

  const last = lastShopCheck();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        active="etsy"
        actions={
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        }
      />
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            My Etsy shop
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Shop check and daily drafts
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The app checks your listings once a day and prepares fixes you approve. Products are
            saved to Etsy as drafts only; you review and publish them yourself.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <Panel title="Connection" icon={<Store className="h-5 w-5 text-primary" />}>
          {connected ? (
            <p className="text-sm">
              Connected to <strong>{settings.etsyShopName}</strong>.{" "}
              <Link to="/settings" className="underline">
                Change in Settings
              </Link>
            </p>
          ) : (
            <p className="text-sm">
              Not connected yet.{" "}
              <Link to="/settings" className="font-medium underline">
                Open Settings → Etsy shop
              </Link>{" "}
              to add your Etsy app keys and press Connect Etsy.
            </p>
          )}
        </Panel>

        <Panel
          title="Shop check"
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
          action={
            <Button variant="outline" onClick={runCheck} disabled={!connected || checking}>
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check now
            </Button>
          }
        >
          {!reports && (
            <p className="text-sm text-muted-foreground">
              {last
                ? `Last check ${last.at}: ${last.flagged} of ${last.total} listings need attention.`
                : "No check yet."}
            </p>
          )}
          {reports && reports.length === 0 && (
            <p className="text-sm text-sage">All {total} active listings look fine.</p>
          )}
          {reports && reports.length > 0 && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {reports.length} of {total} active listings need attention. “Apply fix” changes the
                title, tags or description on Etsy; nothing else is touched.
              </p>
              <ul className="space-y-3">
                {reports.map((r) => {
                  const id = r.listing.listing_id;
                  const done = applied.has(id);
                  return (
                    <li key={id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <a
                          href={r.listing.url || `https://www.etsy.com/listing/${id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-medium hover:underline"
                        >
                          {r.listing.title.slice(0, 90)} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {r.fix && (
                          <Button
                            size="sm"
                            variant={done ? "ghost" : "default"}
                            disabled={done || applying === id}
                            onClick={() => applyFix(r)}
                          >
                            {done ? (
                              <>
                                <Check className="h-4 w-4" /> Applied
                              </>
                            ) : applying === id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Apply fix"
                            )}
                          </Button>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {r.issues.map((i) => (
                          <li key={i.text} className="flex gap-2">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                i.level === "high"
                                  ? "bg-destructive"
                                  : i.level === "medium"
                                    ? "bg-amber-500"
                                    : "bg-muted-foreground/50"
                              }`}
                            />
                            {i.text}
                          </li>
                        ))}
                      </ul>
                      {r.fix && !done && (
                        <div className="mt-3 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          {r.fix.title && (
                            <p>
                              <strong>New title:</strong> {r.fix.title}
                            </p>
                          )}
                          {r.fix.tags && (
                            <p>
                              <strong>New tags ({r.fix.tags.length}):</strong>{" "}
                              {r.fix.tags.join(", ")}
                            </p>
                          )}
                          {r.fix.description && (
                            <p>
                              <strong>Description:</strong> adds{" "}
                              {r.fix.description
                                .slice(r.listing.description.trimEnd().length)
                                .trim()
                                .split("\n")
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Daily product drafts"
          icon={<CalendarClock className="h-5 w-5 text-primary" />}
        >
          <p className="text-sm text-muted-foreground">
            Add the products you want. Each day the app makes the next one and saves it to Etsy as a
            draft (never published).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="e.g. Bobble stitch tree sweater"
              className="flex-1"
              aria-label="Product idea"
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Product type"
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <Button
              disabled={newIdea.trim().length < 3}
              onClick={() => {
                updateQueue([
                  ...queue,
                  { id: crypto.randomUUID(), idea: newIdea.trim(), kind: newKind },
                ]);
                setNewIdea("");
              }}
            >
              Add
            </Button>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.dailyAuto}
              onChange={(e) => save({ ...settings, dailyAuto: e.target.checked })}
            />
            <span>
              Make it automatically when I open the app (skips the cost question). Otherwise the app
              shows a “Make today’s draft” button.
            </span>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pp">Price for crochet patterns (USD)</Label>
              <Input
                id="pp"
                type="number"
                min={0.2}
                step={0.01}
                value={settings.etsyPricePattern}
                onChange={(e) =>
                  save({ ...settings, etsyPricePattern: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="pd">Price for other digital files (USD)</Label>
              <Input
                id="pd"
                type="number"
                min={0.2}
                step={0.01}
                value={settings.etsyPriceDigital}
                onChange={(e) =>
                  save({ ...settings, etsyPriceDigital: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {queue.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {queue.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{q.idea}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel(q.kind)}
                      {q.doneAt && ` · draft made ${q.doneAt}`}
                      {q.error && !q.doneAt && ` · last try failed: ${q.error}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {q.editUrl && (
                      <a
                        href={q.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                      >
                        Open draft
                      </a>
                    )}
                    {!q.doneAt && (
                      <Link
                        to="/"
                        search={{ tab: q.kind === "crochet" ? "crochet" : "product", daily: q.id }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                      >
                        Make now
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => updateQueue(queue.filter((x) => x.id !== q.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
      <SiteFooter />
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="paper-card p-6 sm:p-7">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
