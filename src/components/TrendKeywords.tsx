import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, ListPlus, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasTextKey, useSettings } from "@/lib/settings-store";
import { addToQueue, etsyConnected, todayKey } from "@/lib/etsy/client";
import {
  findTodayKeywords,
  keywordSearchCost,
  keywordsDue,
  loadKeywordDays,
  type KeywordDay,
} from "@/lib/crochet/keywords";

const asIdea = (keyword: string) => keyword.replace(/\s+pattern$/i, "");

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/** Today's trending crochet pattern keywords, found once a day, with earlier days below. */
export function TrendKeywords({ busy, onUse }: { busy: boolean; onUse: (idea: string) => void }) {
  const [settings, save] = useSettings();
  const [days, setDays] = useState<KeywordDay[]>([]);
  const [finding, setFinding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const autoRan = useRef(false);
  const textReady = hasTextKey(settings);
  const connected = etsyConnected(settings);

  useEffect(() => setDays(loadKeywordDays()), []);

  async function find() {
    setFinding(true);
    setErr(null);
    try {
      await findTodayKeywords();
      setDays(loadKeywordDays());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setFinding(false);
    }
  }

  // Once a day, the first time this page opens with an AI key.
  useEffect(() => {
    if (autoRan.current || !settings.dailyKeywords || !textReady || !keywordsDue()) return;
    autoRan.current = true;
    void find();
  }, [settings.dailyKeywords, textReady]);

  const today = days.find((d) => d.date === todayKey());
  const latest = today ?? days[0];
  const older = days.filter((d) => d !== latest);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            {today ? "Today's trending keywords" : "Trending keywords"}
            {latest && (
              <span className="font-normal text-muted-foreground">· {fmtDate(latest.date)}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Crochet pattern searches with rising demand and few Etsy patterns. New ones come every
            day when you open this page.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={find} disabled={finding || !textReady}>
          {finding ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          {finding ? "Searching trends…" : today ? "Find more" : "Find today's keywords"}
        </Button>
      </div>

      {finding && (
        <p className="mt-3 text-xs text-muted-foreground">
          Searching TikTok, Pinterest and fashion trend reports, then checking Etsy. This takes a
          minute or two.
        </p>
      )}
      {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
      {!textReady && (
        <p className="mt-3 text-xs text-muted-foreground">
          Add a Claude, Gemini or OpenRouter key in Settings to find new keywords every day.
        </p>
      )}

      {latest && (
        <ol className="mt-3 space-y-2">
          {latest.items.map((k, i) => (
            <li key={k.keyword} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <span className="text-sm font-semibold">{k.keyword}</span>
                {i === 0 && k.competition != null && <Badge>Best pick</Badge>}
                {k.competition != null && (
                  <span className="text-xs text-muted-foreground">
                    {k.competition.toLocaleString()} Etsy listings · {k.favorites ?? 0} avg
                    favorites
                  </span>
                )}
              </div>
              {k.why && <p className="mt-1 text-xs text-muted-foreground">{k.why}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-7"
                  disabled={busy}
                  onClick={() => onUse(asIdea(k.keyword))}
                >
                  Make this pattern
                </Button>
                {connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      const added = addToQueue([{ idea: asIdea(k.keyword), kind: "crochet" }]);
                      toast.success(
                        added.length ? "Added to the daily Etsy drafts." : "Already in the queue.",
                      );
                    }}
                  >
                    <ListPlus className="mr-1 h-3.5 w-3.5" /> Daily draft
                  </Button>
                )}
                {k.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                  >
                    {s.title || new URL(s.url).hostname} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        {latest && !latest.searched && (
          <p>
            These came from the AI's own knowledge, because this key cannot search the web. A Claude
            key, or billing on the Gemini key, adds live web search.
          </p>
        )}
        {!connected && (
          <p>Connect Etsy in Settings to see how many listings compete for each keyword.</p>
        )}
        <p>
          An estimate from web trends, not Etsy's own search numbers. Each search costs{" "}
          {keywordSearchCost(settings)}.
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={settings.dailyKeywords}
            onChange={(e) => save({ ...settings, dailyKeywords: e.target.checked })}
          />
          Find new keywords by itself once a day
        </label>
      </div>

      {older.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="text-xs font-medium underline"
            onClick={() => setShowOld(!showOld)}
          >
            {showOld ? "Hide earlier days" : `Earlier days (${older.length})`}
          </button>
          {showOld && (
            <div className="mt-2 space-y-2">
              {older.map((d) => (
                <div key={d.date}>
                  <p className="text-xs font-semibold">{fmtDate(d.date)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {d.items.map((k) => (
                      <button
                        key={k.keyword}
                        type="button"
                        title={k.why}
                        disabled={busy}
                        onClick={() => onUse(asIdea(k.keyword))}
                        className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs hover:border-primary disabled:opacity-50"
                      >
                        {k.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
