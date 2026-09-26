"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GithubIcon } from "@/components/brand-icons";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Ledger", href: "/app" },
  { label: "Playground", href: "/app/playground" },
  { label: "Chain", href: "/app/chain" },
  { label: "Docs", href: "/docs" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 ring-1 ring-accent/30">
            <span className="size-2 rounded-full bg-accent" />
          </span>
          Carltine
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <a
            href="https://github.com/carltine/carltine"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub"
            className="ml-2 flex size-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent-dim hover:text-accent"
          >
            <GithubIcon className="size-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
