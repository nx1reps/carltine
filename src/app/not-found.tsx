import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="font-mono text-sm text-accent">404</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          This route is not in the catalog
        </h1>
        <p className="mt-3 max-w-md text-pretty text-muted">
          The page you asked for does not exist. The router, however, always
          knows where to send a request.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/app/playground"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-black"
          >
            Open the playground
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm text-foreground transition-colors hover:border-accent"
          >
            Back home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
