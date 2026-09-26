import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Shared shell for the secondary marketing pages. */
export function MarketingPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="container-page py-20">
        <div className="mx-auto max-w-3xl">
          {eyebrow && (
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">
              {description}
            </p>
          )}
          <div className="mt-12 space-y-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** A titled block within a marketing page. */
export function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export function ProseLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-accent hover:underline">
      {children}
    </Link>
  );
}
