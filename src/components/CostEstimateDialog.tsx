import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Coins, ExternalLink } from "lucide-react";
import { useState } from "react";
import { type Estimate, formatUsd, formatCredits } from "@/lib/cost-estimator";

type Props = {
  open: boolean;
  estimate: Estimate | null;
  onCancel: () => void;
  onConfirm: (rememberSession: boolean) => void;
};

export function CostEstimateDialog({ open, estimate, onCancel, onConfirm }: Props) {
  const [remember, setRemember] = useState(false);
  if (!estimate) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Estimated cost for this run
          </DialogTitle>
          <DialogDescription>
            Using <span className="font-medium">{estimate.providerLabel}</span> ·{" "}
            {estimate.totalCalls} API call{estimate.totalCalls === 1 ? "" : "s"} total. Confirm
            before we spend any credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
          {estimate.items.map((it, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b last:border-b-0 border-border/50 pb-2 last:pb-0"
            >
              <div>
                <div className="font-medium">{it.label}</div>
                <div className="text-xs text-muted-foreground">
                  {it.count} × {formatUsd(it.perCallUsd)}
                  {it.perCallCredits != null ? ` (${formatCredits(it.perCallCredits)})` : ""}
                  {it.model ? ` · ${it.model}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{formatUsd(it.totalUsd)}</div>
                {it.totalCredits != null && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatCredits(it.totalCredits)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated total
            </div>
            <div className="text-2xl font-bold tabular-nums">{formatUsd(estimate.totalUsd)}</div>
            {estimate.totalCredits != null && (
              <div className="text-xs text-muted-foreground tabular-nums">
                ≈ {formatCredits(estimate.totalCredits)} credits
              </div>
            )}
          </div>
          {estimate.billingUrl && (
            <a
              href={estimate.billingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              Billing <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Estimates only. Actual cost depends on prompt length, retries on failures, and current
            provider pricing.
            {estimate.freeNote ? ` ${estimate.freeNote}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="remember-cost"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <label htmlFor="remember-cost" className="text-xs text-muted-foreground cursor-pointer">
            Don't ask again this session
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(remember)}>
            Confirm & run · {formatUsd(estimate.totalUsd)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
