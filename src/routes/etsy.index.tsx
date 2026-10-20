import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CalendarClock,
  Check,
  DollarSign,
  ExternalLink,
  Loader2,
  Moon,
  RefreshCw,
  Sparkles,
  Store,
  Sun,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";
import { hasAiKey, useSettings } from "@/lib/settings-store";
import { PRODUCT_TYPES } from "@/lib/product-types";
import {
  addToQueue,
  draftsToday,
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
import { checkListing, type Fix, type ListingLike, type ListingReport } from "@/lib/etsy/check";
import {
  aiPost,
  findDemandIdeas,
  marketFor,
  priceKeyword,
  suggestPrice,
  upcomingSales,
  type DemandIdea,
  type PriceAdvice,
} from "@/lib/etsy/growth";

export const Route = createFileRoute("/etsy/")({
  head: () => ({ meta: [{ title: "My Etsy shop · Digital Product AI Automation" }] }),
  component: EtsyPage,
});

const KINDS = [
  { id: "crochet", label: "Crochet pattern (PDF)" },
  ...PRODUCT_TYPES.map((t) => ({ id: t.id, label: t.label })),
];
const kindLabel = (id: string) => KINDS.find((k) => k.id === id)?.label ?? id;

type SeoIdea = { title: string; tags: string[]; description: string };
type PriceIdea = { keyword: string; competition: number; advice: PriceAdvice | null };

/** Suggestions survive a reload so the daily run's work is still there when the user looks. */
function useStored<T>(key: string): [Record<number, T>, (id: number, v: T | null) => void] {
  const [map, setMap] = useState<Record<number, T>>({});
  useEffect(() => {
    try {
      setMap(JSON.parse(localStorage.getItem(key) || "{}") as Record<number, T>);
    } catch {
      /* ignore */
    }
  }, [key]);
  const set = (id: number, v: T | null) =>
    setMap((m) => {
      const next = { ...m };
      if (v === null) delete next[id];
      else next[id] = v;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [map, set];
}

const money = (n: number) => `$${n.toFixed(2)}`;
const priceOf = (l: ListingLike) => (l.price ? l.price.amount / l.price.divisor : 0);
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

function EtsyPage() {
  const [settings, save] = useSettings();
  const { theme, toggle } = useTheme();
  const connected = etsyConnected(settings);
  const aiReady = hasAiKey(settings);

  const [checking, setChecking] = useState(false);
  const [reports, setReports] = useState<ListingReport[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [applied, setApplied] = useState<Record<number, string[]>>({});
  const [working, setWorking] = useState<Record<number, string>>({});
  const [seoIdeas, setSeoIdea] = useStored<SeoIdea>("etsyforge:seo-ideas");
  const [priceIdeas, setPriceIdea] = useStored<PriceIdea>("etsyforge:price-ideas");
  const [bulk, setBulk] = useState<string | null>(null);

  const [queue, setQueue] = useState<DailyItem[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [newKind, setNewKind] = useState("crochet");
  const [ideaKind, setIdeaKind] = useState("crochet");
  const [ideas, setIdeas] = useState<DemandIdea[] | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);

  useEffect(() => setQueue(loadQueue()), []);
  const updateQueue = (q: DailyItem[]) => {
    setQueue(q);
    saveQueue(q);
  };

  const busyOn = (id: number, what: string | null) =>
    setWorking((w) => {
      const n = { ...w };
      if (what) n[id] = what;
      else delete n[id];
      return n;
    });
  const markApplied = (id: number, what: string) =>
    setApplied((a) => ({ ...a, [id]: [...(a[id] ?? []), what] }));

  async function runCheck(daily = false) {
    setChecking(true);
    try {
      const { listings } = await etsyCall<{ listings: ListingLike[] }>({ action: "listings" });
      const order = { high: 0, medium: 1, low: 2 };
      const all = listings
        .map((l) => checkListing(l, settings.etsyShopName))
        .sort(
          (a, b) =>
            Math.min(3, ...a.issues.map((i) => order[i.level])) -
            Math.min(3, ...b.issues.map((i) => order[i.level])),
        );
      setReports(all);
      setApplied({});
      const flagged = all.filter((r) => r.issues.length);
      storeShopCheck({ at: todayKey(), total: listings.length, flagged: flagged.length });
      // The daily run also drafts AI SEO for the 5 listings that need it most.
      if (daily && aiReady) {
        let have: Record<number, SeoIdea> = {};
        try {
          have = JSON.parse(localStorage.getItem("etsyforge:seo-ideas") || "{}");
        } catch {
          /* ignore */
        }
        const todo = flagged.filter((r) => !have[r.listing.listing_id]).slice(0, 5);
        for (const r of todo) await improveSeo(r.listing, true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  // The daily check runs the first time this page or the generator opens each day.
  useEffect(() => {
    if (connected && shopCheckDue()) void runCheck(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function update(l: ListingLike, fields: Fix, what: string) {
    busyOn(l.listing_id, what);
    try {
      await etsyCall({ action: "update", listingId: l.listing_id, fields });
      markApplied(l.listing_id, what);
      toast.success("Listing updated on Etsy.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busyOn(l.listing_id, null);
    }
  }

  async function improveSeo(l: ListingLike, quiet = false) {
    busyOn(l.listing_id, "seo");
    try {
      const market = (await marketFor([priceKeyword(l.title)]))[0];
      const r = await aiPost<SeoIdea>("/api/improve-listing", {
        title: l.title,
        description: l.description,
        tags: l.tags,
        competitorTitles: market && !market.error ? market.topTitles : [],
      });
      // Keep the disclosure lines the shop check asks for.
      const extra = checkListing({ ...l, ...r }, settings.etsyShopName).fix?.description;
      setSeoIdea(l.listing_id, { ...r, description: extra ?? r.description });
    } catch (e) {
      if (!quiet) toast.error((e as Error).message);
    } finally {
      busyOn(l.listing_id, null);
    }
  }

  async function checkPrices(list: ListingLike[]) {
    const keywords = list.map((l) => priceKeyword(l.title));
    const markets = await marketFor(keywords);
    list.forEach((l, i) => {
      const m = markets[i];
      if (!m || m.error) return;
      setPriceIdea(l.listing_id, {
        keyword: m.keywords,
        competition: m.count,
        advice: suggestPrice(m, settings.etsyMinPrice),
      });
    });
  }

  async function bulkPrices() {
    if (!reports) return;
    const todo = reports
      .map((r) => r.listing)
      .filter((l) => !priceIdeas[l.listing_id])
      .slice(0, 12);
    if (!todo.length) return toast.info("All listings already have price advice.");
    setBulk("price");
    try {
      await checkPrices(todo);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulk(null);
    }
  }

  async function bulkSeo() {
    if (!reports) return;
    const todo = reports
      .map((r) => r.listing)
      .filter((l) => !seoIdeas[l.listing_id])
      .slice(0, 5);
    setBulk("seo");
    for (const l of todo) await improveSeo(l, true);
    setBulk(null);
  }

  async function setPrice(l: ListingLike, price: number) {
    busyOn(l.listing_id, "price");
    try {
      await etsyCall({ action: "price", listingId: l.listing_id, price });
      markApplied(l.listing_id, "price");
      toast.success(`Price set to ${money(price)} on Etsy.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busyOn(l.listing_id, null);
    }
  }

  async function searchIdeas() {
    setIdeasBusy(true);
    try {
      setIdeas(await findDemandIdeas(ideaKind, 10));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIdeasBusy(false);
    }
  }

  const last = lastShopCheck();
  const shown = reports?.filter(
    (r) => showAll || r.issues.length || seoIdeas[r.listing.listing_id],
  );
  const flaggedCount = reports?.filter((r) => r.issues.length).length ?? 0;
  const sales = upcomingSales();

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
            Shop check, SEO, prices and daily drafts
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The app checks your listings once a day and prepares fixes. Nothing changes on Etsy
            until you press Apply, and new products are saved as drafts for you to publish.
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
              {!aiReady && " Add a Gemini or OpenRouter key in Settings for AI SEO and ideas."}
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
            <Button
              variant="outline"
              onClick={() => void runCheck()}
              disabled={!connected || checking}
            >
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
          {reports && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {flaggedCount} of {reports.length} active listings need attention.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={bulkSeo}
                    disabled={!!bulk || !aiReady}
                  >
                    {bulk === "seo" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    AI SEO for next 5
                  </Button>
                  <Button size="sm" variant="outline" onClick={bulkPrices} disabled={!!bulk}>
                    {bulk === "price" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                    Check prices for next 12
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Only listings with issues" : "Show all listings"}
                  </Button>
                </div>
              </div>
              <ul className="space-y-3">
                {shown!.map((r) => (
                  <ListingCard
                    key={r.listing.listing_id}
                    report={r}
                    seo={seoIdeas[r.listing.listing_id]}
                    price={priceIdeas[r.listing.listing_id]}
                    applied={applied[r.listing.listing_id] ?? []}
                    working={working[r.listing.listing_id]}
                    aiReady={aiReady}
                    onFix={() => r.fix && update(r.listing, r.fix, "fix")}
                    onImprove={() => improveSeo(r.listing)}
                    onApplySeo={(s) => update(r.listing, s, "seo")}
                    onDropSeo={() => setSeoIdea(r.listing.listing_id, null)}
                    onCheckPrice={async () => {
                      busyOn(r.listing.listing_id, "price-check");
                      try {
                        await checkPrices([r.listing]);
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        busyOn(r.listing.listing_id, null);
                      }
                    }}
                    onSetPrice={(p) => setPrice(r.listing, p)}
                  />
                ))}
              </ul>
            </>
          )}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Label htmlFor="minp" className="shrink-0">
              Lowest price the advice may suggest (USD)
            </Label>
            <Input
              id="minp"
              type="number"
              min={0.2}
              step={0.01}
              className="w-28"
              value={settings.etsyMinPrice}
              onChange={(e) => save({ ...settings, etsyMinPrice: Number(e.target.value) || 0.2 })}
            />
          </div>
        </Panel>

        <Panel title="Sales and discounts" icon={<BadgePercent className="h-5 w-5 text-primary" />}>
          <p className="text-sm text-muted-foreground">
            Etsy does not let apps create sales or coupons, so set these up in Shop Manager. Run
            sales only around shopping events; a sale that never ends looks like a fake discount.
          </p>
          {sales.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {sales.map((s) => (
                <li key={s.event} className="rounded-md border border-border bg-card p-3">
                  <strong>{s.event}</strong> ({fmtDay(s.date)}): run a {s.percent}% sale from{" "}
                  {fmtDay(s.start)} to {fmtDay(s.end)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">No big shopping event in the next 60 days.</p>
          )}
          <a
            href="https://www.etsy.com/your/shops/me/sales-discounts"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline"
          >
            Open Sales and discounts on Etsy <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Panel>

        <Panel
          title="Daily product drafts"
          icon={<CalendarClock className="h-5 w-5 text-primary" />}
        >
          <p className="text-sm text-muted-foreground">
            Each day the app makes the next ideas in this list and saves them to Etsy as drafts
            (never published). {draftsToday()} made today.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="dc">Drafts per day</Label>
              <select
                id="dc"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={settings.dailyCount}
                onChange={(e) => save({ ...settings, dailyCount: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                AI cost per draft: about $0.30 to $1 with mockups, a few cents for a crochet PDF.
              </p>
            </div>
            <div>
              <Label htmlFor="pp">Crochet pattern price (USD)</Label>
              <Input
                id="pp"
                type="number"
                min={0.2}
                step={0.01}
                className="mt-1"
                value={settings.etsyPricePattern}
                onChange={(e) =>
                  save({ ...settings, etsyPricePattern: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="pd">Other digital file price (USD)</Label>
              <Input
                id="pd"
                type="number"
                min={0.2}
                step={0.01}
                className="mt-1"
                value={settings.etsyPriceDigital}
                onChange={(e) =>
                  save({ ...settings, etsyPriceDigital: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.dailyAuto}
              onChange={(e) => save({ ...settings, dailyAuto: e.target.checked })}
            />
            <span>
              Make them automatically when I open the app (skips the cost question). Otherwise the
              generator shows a “Make today’s draft” button.
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.dailyAutoIdeas}
              onChange={(e) => save({ ...settings, dailyAutoIdeas: e.target.checked })}
            />
            <span>
              When the list runs out, add the best demand-checked ideas for{" "}
              <select
                value={settings.dailyIdeasKind}
                onChange={(e) => save({ ...settings, dailyIdeasKind: e.target.value })}
                className="rounded border border-input bg-background px-1 py-0.5 text-sm"
                aria-label="Kind of ideas"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>{" "}
              by itself.
            </span>
          </label>

          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-primary" /> Find ideas with demand
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              AI suggests trend ideas, then the app searches Etsy for each: fewer competing listings
              and more favorites on the top results score higher. Etsy shares no search volume, so
              treat the score as an estimate.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={ideaKind}
                onChange={(e) => setIdeaKind(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Idea type"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <Button onClick={searchIdeas} disabled={ideasBusy || !connected || !aiReady}>
                {ideasBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Find ideas
              </Button>
            </div>
            {ideas && (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">Idea</th>
                    <th className="py-1 font-medium">Competing listings</th>
                    <th className="py-1 font-medium">Avg favorites</th>
                    <th className="py-1 font-medium">Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ideas.map((i) => (
                    <tr key={i.idea} className="border-t border-border">
                      <td className="py-2 pr-2">
                        {i.idea}
                        <span className="block text-xs text-muted-foreground">“{i.keyword}”</span>
                      </td>
                      <td className="py-2">{i.competition.toLocaleString()}</td>
                      <td className="py-2">{i.favorites}</td>
                      <td className="py-2 font-medium">{i.score}</td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={queue.some((q) => q.idea === i.idea)}
                          onClick={() => {
                            addToQueue([
                              {
                                idea: i.idea,
                                kind: i.kind,
                                competition: i.competition,
                                favorites: i.favorites,
                              },
                            ]);
                            setQueue(loadQueue());
                          }}
                        >
                          {queue.some((q) => q.idea === i.idea) ? "Added" : "Add"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Or type your own idea, e.g. Bobble stitch tree sweater"
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
                addToQueue([{ idea: newIdea.trim(), kind: newKind }]);
                setQueue(loadQueue());
                setNewIdea("");
              }}
            >
              Add
            </Button>
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
                      {q.competition !== undefined &&
                        ` · ${q.competition.toLocaleString()} competing listings, ${q.favorites ?? 0} avg favorites`}
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

function ListingCard({
  report: r,
  seo,
  price,
  applied,
  working,
  aiReady,
  onFix,
  onImprove,
  onApplySeo,
  onDropSeo,
  onCheckPrice,
  onSetPrice,
}: {
  report: ListingReport;
  seo?: SeoIdea;
  price?: PriceIdea;
  applied: string[];
  working?: string;
  aiReady: boolean;
  onFix: () => void;
  onImprove: () => void;
  onApplySeo: (s: SeoIdea) => void;
  onDropSeo: () => void;
  onCheckPrice: () => void;
  onSetPrice: (p: number) => void;
}) {
  const l = r.listing;
  const current = priceOf(l);
  const done = (w: string) => applied.includes(w);
  const spin = <Loader2 className="h-4 w-4 animate-spin" />;
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a
          href={l.url || `https://www.etsy.com/listing/${l.listing_id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 font-medium hover:underline"
        >
          {l.title.slice(0, 90)} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <span className="text-sm text-muted-foreground">{current ? money(current) : ""}</span>
      </div>

      {r.issues.length > 0 && (
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
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {r.fix && !seo && (
          <Button size="sm" disabled={done("fix") || !!working} onClick={onFix}>
            {working === "fix" ? spin : done("fix") ? <Check className="h-4 w-4" /> : null}
            {done("fix") ? "Quick fix applied" : "Apply quick fix"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={!!working || !aiReady} onClick={onImprove}>
          {working === "seo" ? spin : <Sparkles className="h-4 w-4" />}
          {seo ? "Rewrite again" : "Improve SEO with AI"}
        </Button>
        <Button size="sm" variant="outline" disabled={!!working} onClick={onCheckPrice}>
          {working === "price-check" ? spin : <DollarSign className="h-4 w-4" />}
          Check price
        </Button>
      </div>

      {r.fix && !seo && !done("fix") && (
        <div className="mt-3 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {r.fix.title && (
            <p>
              <strong>New title:</strong> {r.fix.title}
            </p>
          )}
          {r.fix.tags && (
            <p>
              <strong>New tags ({r.fix.tags.length}):</strong> {r.fix.tags.join(", ")}
            </p>
          )}
          {r.fix.description && (
            <p>
              <strong>Description:</strong> adds{" "}
              {r.fix.description
                .slice(l.description.trimEnd().length)
                .trim()
                .split("\n")
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      {seo && (
        <div className="mt-3 space-y-2 rounded-md border border-primary/30 bg-accent/40 p-3 text-xs">
          <p>
            <strong>AI title ({seo.title.length}/140):</strong> {seo.title}
          </p>
          <p>
            <strong>AI tags ({seo.tags.length}/13):</strong> {seo.tags.join(", ")}
          </p>
          <details>
            <summary className="cursor-pointer font-medium">AI description</summary>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{seo.description}</pre>
          </details>
          <div className="flex gap-2">
            <Button size="sm" disabled={done("seo") || !!working} onClick={() => onApplySeo(seo)}>
              {working === "seo" ? spin : done("seo") ? <Check className="h-4 w-4" /> : null}
              {done("seo") ? "SEO applied" : "Apply title, tags and description"}
            </Button>
            {!done("seo") && (
              <Button size="sm" variant="ghost" onClick={onDropSeo}>
                Discard
              </Button>
            )}
          </div>
        </div>
      )}

      {price && (
        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs">
          {price.advice ? (
            <>
              <p>
                “{price.keyword}”: {price.competition.toLocaleString()} competing listings. Typical
                price {money(price.advice.low)} to {money(price.advice.high)}, middle{" "}
                {money(price.advice.median)} ({price.advice.sample} checked).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>
                  Suggested: <strong>{money(price.advice.suggested)}</strong>
                  {current > 0 && ` (now ${money(current)})`}
                </span>
                {Math.abs(price.advice.suggested - current) >= 0.01 && (
                  <Button
                    size="sm"
                    disabled={done("price") || !!working}
                    onClick={() => onSetPrice(price.advice!.suggested)}
                  >
                    {working === "price" ? (
                      spin
                    ) : done("price") ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                    {done("price") ? "Price set" : `Set price ${money(price.advice.suggested)}`}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p>“{price.keyword}”: too few similar listings with prices to suggest one.</p>
          )}
        </div>
      )}
    </li>
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
