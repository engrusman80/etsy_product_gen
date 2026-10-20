import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Image as ImageIcon, Scissors, Wand2 } from "lucide-react";

export type NavKey = "home" | "product" | "crochet" | "adobe";

type NavItem = { key: NavKey; label: string; icon: typeof Wand2 };

const ITEMS: NavItem[] = [
  { key: "product", label: "Create product", icon: Wand2 },
  { key: "crochet", label: "Crochet patterns", icon: Scissors },
  { key: "adobe", label: "Adobe Stock", icon: ImageIcon },
];

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M12 12v8M12 12 5 7.5M12 12l7-4.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

/**
 * Shared top bar. Generator tabs (home/product/crochet) live on "/" and switch in place
 * through `onNavigate`; the other pages are separate routes.
 */
export function SiteHeader({
  active,
  onNavigate,
  actions,
}: {
  active: NavKey;
  onNavigate?: (key: "home" | "product" | "crochet") => void;
  actions?: ReactNode;
}) {
  const itemClass = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      on
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  const renderItem = (it: NavItem) => {
    const on = active === it.key;
    const body = (
      <>
        <it.icon className="h-4 w-4" />
        {it.label}
      </>
    );
    if (it.key === "adobe")
      return (
        <Link key={it.key} to="/adobe-stock" className={itemClass(on)}>
          {body}
        </Link>
      );
    const tab = it.key as "product" | "crochet";
    if (onNavigate)
      return (
        <button
          key={it.key}
          type="button"
          onClick={() => onNavigate(tab)}
          className={itemClass(on)}
        >
          {body}
        </button>
      );
    return (
      <Link key={it.key} to="/" search={{ tab }} className={itemClass(on)}>
        {body}
      </Link>
    );
  };

  const brand = (
    <>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[16px] font-semibold tracking-tight sm:text-[19px]">
          Digital Product <span className="italic text-primary">AI Automation</span>
        </span>
        <span className="mt-1 hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
          AI for Etsy sellers
        </span>
      </span>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border glass-panel">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="flex items-center gap-3 text-left"
          >
            {brand}
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-3">
            {brand}
          </Link>
        )}
        <nav className="hidden items-center gap-1 lg:flex">{ITEMS.map(renderItem)}</nav>
        <div className="flex items-center gap-1">{actions}</div>
      </div>
      <nav className="-mt-1 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
        {ITEMS.map(renderItem)}
      </nav>
    </header>
  );
}
