import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, ArrowLeft, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/keywords")({
  head: () => ({
    meta: [
      { title: "Keyword Research — Etsy Digital Products" },
      { name: "description", content: "Find low-competition, high-volume keywords for Etsy digital products with real search data." },
    ],
  }),
  component: KeywordsPage,
});

type Row = {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  difficulty: number;
  results: number;
  trend: number[];
};

const COUNTRIES: { code: string; label: string }[] = [
  { code: "us", label: "United States" },
  { code: "uk", label: "United Kingdom" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "nl", label: "Netherlands" },
  { code: "br", label: "Brazil" },
  { code: "in", label: "India" },
  { code: "jp", label: "Japan" },
  { code: "mx", label: "Mexico" },
];

function KdBadge({ v }: { v: number }) {
  const color = v < 30 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : v < 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : v < 70 ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
    : "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${color}`}>{Math.round(v)}</span>;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const w = 80, h = 24;
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const last = data[data.length - 1], first = data[0];
  const up = last >= first;
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline fill="none" strokeWidth="1.5" stroke={up ? "#10b981" : "#f43f5e"} points={pts} />
    </svg>
  );
}

type Provider = "semrush" | "semrush_user" | "ahrefs" | "keywords_everywhere" | "erank" | "alura";
const PROVIDER_LABEL: Record<Provider, string> = {
  semrush: "Semrush (connector)",
  semrush_user: "Semrush (your key)",
  ahrefs: "Ahrefs (your key)",
  keywords_everywhere: "Keywords Everywhere",
  erank: "eRank (estimated)",
  alura: "Alura (estimated)",
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("etsyforge:settings") || "{}");
    return {
      kwProvider: (s.kwProvider as Provider) || "semrush",
      semrushUserKey: s.semrushUserKey || "",
      ahrefsKey: s.ahrefsKey || "",
      kwEverywhereKey: s.kwEverywhereKey || "",
    };
  } catch {
    return { kwProvider: "semrush" as Provider, semrushUserKey: "", ahrefsKey: "", kwEverywhereKey: "" };
  }
}

function KeywordsPage() {
  const nav = useNavigate();
  const [seed, setSeed] = useState("");
  const [database, setDatabase] = useState("us");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ seed: string; database: string; provider?: Provider; estimated?: boolean; note?: string } | null>(null);
  const [provider, setProvider] = useState<Provider>("semrush");
  const [providerLoaded, setProviderLoaded] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setProvider(s.kwProvider);
    setProviderLoaded(true);
  }, []);

  const [filter, setFilter] = useState("");
  const [minVol, setMinVol] = useState(0);
  const [maxKd, setMaxKd] = useState(100);
  const [maxComp, setMaxComp] = useState(1);
  const [sortBy, setSortBy] = useState<"score" | "volume" | "difficulty" | "cpc">("score");

  async function search() {
    setLoading(true); setError(null); setRows([]);
    try {
      const s = loadSettings();
      const apiKey =
        s.kwProvider === "semrush_user" ? s.semrushUserKey
        : s.kwProvider === "ahrefs" ? s.ahrefsKey
        : s.kwProvider === "keywords_everywhere" ? s.kwEverywhereKey
        : "";
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seed.trim(), database, limit, provider: s.kwProvider, apiKey }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Request failed");
      setRows(j.rows || []);
      setMeta({ seed: j.seed, database: j.database, provider: j.provider, estimated: j.estimated, note: j.note });
      setProvider(s.kwProvider);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let out = rows.filter((r) =>
      r.volume >= minVol &&
      r.difficulty <= maxKd &&
      r.competition <= maxComp &&
      (filter ? r.keyword.toLowerCase().includes(filter.toLowerCase()) : true)
    );
    out = [...out].sort((a, b) => {
      if (sortBy === "volume") return b.volume - a.volume;
      if (sortBy === "difficulty") return a.difficulty - b.difficulty;
      if (sortBy === "cpc") return b.cpc - a.cpc;
      // opportunity score: high volume × low difficulty
      const sa = (a.volume + 1) / (a.difficulty + 5);
      const sb = (b.volume + 1) / (b.difficulty + 5);
      return sb - sa;
    });
    return out;
  }, [rows, filter, minVol, maxKd, maxComp, sortBy]);

  function useKeyword(k: string) {
    try { localStorage.setItem("etsyforge:seed", k); } catch {}
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-16 border-b border-border glass-panel">
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-lg font-bold tracking-tight">Keyword Research</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Etsy Digital Products</span>
            </div>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Generator
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Find low-competition keywords</CardTitle>
                <CardDescription className="mt-1">
                  Enter a seed keyword (e.g. "boho printable", "funny mug svg", "wedding clipart"). We return up to 200 related keywords with real search volume, difficulty, CPC, and trends.
                </CardDescription>
              </div>
              {providerLoaded && (
                <Badge variant="outline" className="shrink-0">
                  Provider: {PROVIDER_LABEL[provider]} · <Link to="/" className="ml-1 underline">change</Link>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px_auto]">
              <div>
                <Label htmlFor="seed" className="text-xs">Seed keyword</Label>
                <Input
                  id="seed" value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                  placeholder="e.g. printable wall art"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="db" className="text-xs">Country</Label>
                <select id="db" value={database} onChange={(e) => setDatabase(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-10">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="lim" className="text-xs">Results</Label>
                <select id="lim" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-10">
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={search} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-2">{seed.trim() ? "Search" : "Top 5 picks"}</span>
                </Button>
              </div>
            </div>

            {meta?.estimated && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                ⚠ Volume / difficulty shown are <strong>estimates</strong> from a curated Etsy keyword library (eRank & Alura don't offer public APIs). For real metrics, switch to Semrush, Ahrefs, or Keywords Everywhere in Settings.
              </div>
            )}
            {meta?.note && !error && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">{meta.note}</div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                <div>
                  <div className="font-medium text-destructive">{error}</div>
                  {error.includes("not connected") && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Tell the project owner to connect the Semrush connector. Once linked, this page works automatically.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <>
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <Label className="text-xs">Filter keyword</Label>
                    <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="contains…" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Min volume: {minVol}</Label>
                    <input type="range" min={0} max={10000} step={50} value={minVol} onChange={(e) => setMinVol(Number(e.target.value))} className="mt-3 w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Max difficulty: {maxKd}</Label>
                    <input type="range" min={0} max={100} step={1} value={maxKd} onChange={(e) => setMaxKd(Number(e.target.value))} className="mt-3 w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Max competition: {maxComp.toFixed(2)}</Label>
                    <input type="range" min={0} max={1} step={0.05} value={maxComp} onChange={(e) => setMaxComp(Number(e.target.value))} className="mt-3 w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Sort by</Label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9">
                      <option value="score">Opportunity (volume ÷ difficulty)</option>
                      <option value="volume">Volume (high → low)</option>
                      <option value="difficulty">Difficulty (low → high)</option>
                      <option value="cpc">CPC (high → low)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {filtered.length} of {rows.length} for <span className="font-semibold text-foreground">"{meta?.seed}"</span> · {meta?.database?.toUpperCase()}
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{meta?.provider ? PROVIDER_LABEL[meta.provider] : PROVIDER_LABEL[provider]}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Keyword</th>
                        <th className="px-3 py-2 text-right">Volume</th>
                        <th className="px-3 py-2 text-center">KD</th>
                        <th className="px-3 py-2 text-right">CPC ($)</th>
                        <th className="px-3 py-2 text-right">Comp.</th>
                        <th className="px-3 py-2 text-center">12-mo Trend</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.keyword} className="border-t border-border/60 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{r.keyword}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.volume.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center"><KdBadge v={r.difficulty} /></td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.cpc.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.competition.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center"><Sparkline data={r.trend} /></td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => useKeyword(r.keyword)} className="h-7 text-xs">
                              Use →
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No keywords match the current filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <Card className="mt-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Enter a seed keyword above to find 50–200 related ideas with real search data.
              <br />
              <span className="text-xs">Note: data is from Google (via your selected provider). Etsy demand strongly correlates with Google search for printable / digital / craft niches. Switch providers in Settings.</span>
            </CardContent>
          </Card>
        )}
      </main>
      <footer className="mt-auto border-t border-border bg-muted/20 py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Digital Product Ai Automation. All rights reserved.</p>
          <p className="mt-2 text-xs">Built exclusively for Etsy & Adobe Stock sellers.</p>
        </div>
      </footer>
    </div>
  );
}
