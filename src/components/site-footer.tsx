import { GithubIcon, LinkedinIcon, XIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui";
import { GITHUB_REPO } from "@/lib/site";

const SITEMAP = [
  {
    title: "Product",
    links: [
      { label: "Router playground", href: "/app/playground" },
      { label: "Live ledger", href: "/app" },
      { label: "Chain integrity", href: "/app/chain" },
      { label: "API reference", href: "/docs" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Quickstart", href: "/docs#quickstart" },
      { label: "Self-hosting", href: "/docs#self-hosting" },
      { label: "Configuration", href: "/docs#configuration" },
      { label: "GitHub", href: GITHUB_REPO },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog" },
      { label: "Status", href: "/status" },
    ],
  },
] as const;

const SOCIAL = [
  { label: "GitHub", href: GITHUB_REPO, Icon: GithubIcon },
  { label: "X", href: "https://x.com/carltine", Icon: XIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/carltine", Icon: LinkedinIcon },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-14">
      <div className="container-page">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Carltine</span>
              <Badge tone="accent">v0.1</Badge>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              The agent accountability layer. Route every LLM call to the cheapest
              model that can do the job, and prove the savings.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent-dim hover:text-accent"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {SITEMAP.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Carltine. MIT licensed core.</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="/privacy" className="transition-colors hover:text-muted">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-muted">Terms</a>
            <a href="/security" className="transition-colors hover:text-muted">Security</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
