import { Link } from "@tanstack/react-router";
import { BrandMark } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-paper">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <span className="font-display text-lg font-semibold">
              Digital Product <span className="italic text-primary">AI Automation</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Original, commercial-use artwork, mockups and listing copy for Etsy and Adobe Stock
            sellers. Always check each marketplace's policies before listing.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-4 md:gap-x-8">
          <Link
            to="/"
            search={{ tab: "product" }}
            className="text-muted-foreground hover:text-foreground"
          >
            Create product
          </Link>
          <Link
            to="/"
            search={{ tab: "crochet" }}
            className="text-muted-foreground hover:text-foreground"
          >
            Crochet patterns
          </Link>
          <Link to="/adobe-stock" className="text-muted-foreground hover:text-foreground">
            Adobe Stock
          </Link>
          <Link to="/settings" className="text-muted-foreground hover:text-foreground">
            Settings
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Digital Product AI Automation
        </p>
      </div>
    </footer>
  );
}
