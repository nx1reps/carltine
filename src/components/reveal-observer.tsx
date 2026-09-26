"use client";

import { useEffect } from "react";

/**
 * Drives the CSS scroll reveal.
 *
 * The animation itself lives in CSS (see the `.reveal` rules in globals.css);
 * this only adds `is-in` to elements that should be shown. Keeping the hidden
 * state behind a class that the browser adds only when JavaScript runs is what
 * makes the no-JS case safe: if this component never executes, nothing was ever
 * hidden.
 *
 * The fiddly part is deep links. A plain IntersectionObserver only ever hears
 * about elements that intersect the viewport, so jumping straight to #usage
 * scrolls past everything above it, those elements never intersect, and a
 * `once` observer leaves them hidden permanently. That is not hypothetical: it
 * is what made /docs look blank. So anything already scrolled past is revealed
 * immediately, on init and again whenever the hash changes.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;

    const revealPast = () => {
      const limit = window.innerHeight;
      for (const el of document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)")) {
        // `top` is viewport-relative, so a negative value means the element is
        // above the fold, i.e. already scrolled past.
        if (el.getBoundingClientRect().top < limit) {
          el.classList.add("is-in");
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      // A little lead-in above the fold, so an element is already animating by
      // the time it is properly in view.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    const observeAll = () => {
      for (const el of document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)")) {
        observer.observe(el);
      }
    };

    // Mark the document as JS-capable before the observer starts, so the
    // hidden state and the reveal are driven by the same signal.
    root.classList.add("js-reveal");

    revealPast();
    observeAll();

    // Late-arriving content (client components that render after mount) is not
    // in the initial query, so pick it up as it appears.
    const mutations = new MutationObserver(() => {
      revealPast();
      observeAll();
    });
    mutations.observe(root, { childList: true, subtree: true });

    const onHashChange = () => {
      // The browser has already jumped; let the scroll settle, then un-hide
      // everything at or above the new position.
      requestAnimationFrame(() => requestAnimationFrame(revealPast));
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return null;
}

/**
 * Inline script that sets `js-reveal` before first paint.
 *
 * Rendered in <head> rather than from the effect above on purpose. If the class
 * were added after hydration, the page would paint fully visible and then snap
 * to hidden, which is a worse flash than the animation is worth.
 */
export const REVEAL_BOOTSTRAP = `document.documentElement.classList.add('js-reveal')`;
