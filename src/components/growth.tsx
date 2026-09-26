import { Analytics } from "@/components/analytics";

/**
 * Social and growth integrations.
 *
 * Everything here is gated on an env var so a self-hosted or fork deployment
 * sends data nowhere by default. Each integration is also lazy: the component
 * only imports its SDK client after confirming a key exists, so an unconfigured
 * instance pays nothing in bundle size.
 *
 * None of this is wired into a provider account, because doing that requires
 * credentials we do not have and must not invent.
 */


/** X (formerly Twitter) intent URL, built without a third-party script. */
export function shareOnX({ text, url }: { text: string; url: string }) {
  const href = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(href, "_blank", "noreferrer,noopener,width=600,height=500");
}

export function shareOnLinkedIn({ url }: { url: string }) {
  const href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(href, "_blank", "noreferrer,noopener,width=600,height=500");
}

/** Share sheet. Uses the native API where available, else falls back to X. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  async function onClick() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet; fall through to the intent link.
      }
    }
    shareOnX({ text: title, url });
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted transition-colors hover:border-accent-dim hover:text-accent"
    >
      Share
    </button>
  );
}

/**
 * Newsletter capture.
 *
 * Renders a real form only when a Buttondown username is configured. Buttondown
 * is used because it is a single-form, no-JS-required service, so the markup
 * degrades to a plain email field rather than a JavaScript widget. Without a
 * configured username the component renders nothing at all rather than a form
 * that silently discards addresses.
 */
export function NewsletterForm() {
  const username = process.env.NEXT_PUBLIC_BUTTONDOWN_USER;

  if (!username) return null;

  return (
    <form
      action={`https://buttondown.email/api/emails/embed-subscribe/${username}`}
      method="post"
      target="popupwindow"
      className="flex flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        name="email"
        required
        placeholder="you@company.com"
        className="field flex-1"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black"
      >
        Subscribe
      </button>
    </form>
  );
}

export { Analytics };
