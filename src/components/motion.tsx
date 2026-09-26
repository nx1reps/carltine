"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Motion primitives.
 *
 * `Reveal` is the workhorse: sections animate in once when scrolled into view.
 *
 * It is deliberately CSS-driven rather than built on motion's `whileInView`.
 * `whileInView` writes `opacity: 0` into the server HTML and depends on an
 * IntersectionObserver firing to undo it, which means no JavaScript, a
 * JavaScript error, or an anchor jump past a section all produce a permanently
 * blank region rather than a missing animation. Here the element is visible in
 * the HTML and only hidden once `js-reveal` is on <html>, which the inline
 * bootstrap in the document head sets. The observer in
 * components/reveal-observer.tsx only ever adds a class.
 *
 * Reduced motion needs no branch here: the CSS media query removes the
 * transition and the movement, and the observer still runs.
 */

type RevealTag = "div" | "section" | "li" | "span" | "ul" | "article";

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: RevealTag;
}) {
  const Comp = as;
  return (
    <Comp
      className={cn("reveal", className)}
      // Consumed by the transition-delay in globals.css. A custom property
      // rather than an inline transition so the delay and the transition stay
      // defined together in one place.
      style={delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </Comp>
  );
}

/**
 * A group whose children cascade in.
 *
 * The cascade is CSS `transition-delay` via `:nth-child` rather than motion's
 * `staggerChildren` variants, for the same reason as `Reveal`: the container
 * renders visible in the HTML. It also keeps the DOM identical to what it was
 * before, which matters because every caller puts these items directly inside
 * a CSS grid.
 */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("stagger", className)}>{children}</div>;
}

export function StaggerItem({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  /** Overrides the automatic per-child cascade. Rarely needed. */
  delay?: number;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Count up to a value when scrolled into view.
 *
 * Savings figures are the product's headline claim, so animating them from zero
 * would be dishonest theatre. This animates only when the number is a real
 * measured value, and it is used on the ledger where the figure is derived from
 * actual routed traffic.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  durationMs = 900,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // With reduced motion the value is rendered directly below, so there is no
    // animation to drive and nothing to set.
    if (!inView || reduce) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, durationMs, reduce]);

  const value = reduce ? to : to * progress;

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Ambient grid + glow backdrop used behind the hero and section headers. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-glow" />
      <div className="absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
    </div>
  );
}
