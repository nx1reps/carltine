/**
 * Carltine brand marks.
 *
 * All marks derive from one geometric idea: concentric rings with a single
 * filled node. It reads as a routing decision — many candidate paths, one
 * chosen destination — and it stays legible at 16px, which a wordmark alone
 * does not.
 *
 * Everything is inline SVG with currentColor so marks theme with their context
 * and require no icon-font or sprite request.
 */

type MarkProps = {
  className?: string;
  /** Renders the wordmark beside the glyph. */
  withWordmark?: boolean;
  title?: string;
};

export function CarltineMark({
  className,
  withWordmark = false,
  title = "Carltine",
}: MarkProps) {
  const glyph = (
    <svg
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      className={className}
      role={withWordmark ? "presentation" : "img"}
      aria-label={withWordmark ? undefined : title}
      aria-hidden={withWordmark ? "true" : undefined}
    >
      <defs>
        <linearGradient id="carltine-core" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ade9b" />
          <stop offset="100%" stopColor="#6ba8f5" />
        </linearGradient>
      </defs>
      {/* Candidate paths, receding. */}
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.16"
      />
      <circle
        cx="32"
        cy="32"
        r="17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.34"
      />
      {/* Chosen path, and the node it resolves to. */}
      <circle
        cx="32"
        cy="32"
        r="10.5"
        fill="none"
        stroke="url(#carltine-core)"
        strokeWidth="2.5"
        opacity="0.85"
      />
      <circle cx="32" cy="32" r="4.5" fill="url(#carltine-core)" />
    </svg>
  );

  if (!withWordmark) return glyph;

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/25"
        style={{ fontSize: 22 }}
      >
        {glyph}
      </span>
      <span className="font-semibold tracking-tight text-foreground">{title}</span>
    </span>
  );
}

/**
 * Animated mark for the hero. The outer ring rotates slowly to suggest
 * evaluation across candidates; it stops under reduced motion because the CSS
 * override in globals.css cannot reach an SVG transform declared in markup.
 */
export function CarltineMarkAnimated({ className }: { className?: string }) {
  return (
    <span className={className} style={{ fontSize: "1em" }}>
      <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true">
        <defs>
          <linearGradient id="carltine-anim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ade9b" />
            <stop offset="100%" stopColor="#6ba8f5" />
          </linearGradient>
        </defs>
        <g
          style={{
            transformOrigin: "32px 32px",
            animation: "carltine-spin 18s linear infinite",
          }}
        >
          <circle
            cx="32"
            cy="32"
            r="25"
            fill="none"
            stroke="#4ade9b"
            strokeWidth="1.5"
            strokeDasharray="6 10"
            opacity="0.4"
          />
        </g>
        <circle
          cx="32"
          cy="32"
          r="17.5"
          fill="none"
          stroke="#4ade9b"
          strokeWidth="2"
          opacity="0.3"
        />
        <circle
          cx="32"
          cy="32"
          r="10.5"
          fill="none"
          stroke="url(#carltine-anim)"
          strokeWidth="2.5"
        />
        <circle cx="32" cy="32" r="4.5" fill="url(#carltine-anim)" />
      </svg>
    </span>
  );
}

/**
 * The catalog comparison chart.
 *
 * Real data from the price table, drawn as a log-ish bar comparison. Log scale
 * matters here: the spread between the cheapest and dearest model is roughly
 * three orders of magnitude, so a linear chart renders every cheap model as an
 * invisible sliver and communicates nothing.
 */
export function PriceSpreadChart({ className }: { className?: string }) {
  // Blended $/Mtok (input+output) for representative models per tier.
  const bars = [
    { label: "Qwen3.7 Mini", tier: "T1", value: 0.01 },
    { label: "Qwen3.7 Turbo", tier: "T2", value: 0.05 },
    { label: "DeepSeek V4 Flash", tier: "T2", value: 0.143 },
    { label: "Qwen3.7 Flash", tier: "T3", value: 0.16 },
    { label: "Gemini 3 Flash", tier: "T3", value: 0.38 },
    { label: "GPT-6 Luna", tier: "T3", value: 0.6 },
    { label: "DeepSeek V4 Pro", tier: "T4", value: 1.4 },
    { label: "GPT-6 Sol", tier: "T4", value: 12 },
    { label: "Claude Opus 5", tier: "T5", value: 30 },
    { label: "GPT-6 Astra", tier: "T5", value: 60 },
  ];

  const max = Math.max(...bars.map((b) => b.value));
  const min = Math.min(...bars.map((b) => b.value));
  // Map onto a log scale so all ten bars are readable.
  const scale = (v: number) => 6 + ((Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 94;

  return (
    <figure className={className}>
      <figcaption className="mb-4 text-xs text-muted">
        Blended cost per million tokens, log scale. The spread is{" "}
        <span className="text-accent">{(max / min).toFixed(0)}&times;</span> — the
        reason routing pays.
      </figcaption>
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-xs text-muted">
              {b.label}
            </span>
            <span className="w-7 shrink-0 text-right font-mono text-[10px] text-subtle">
              {b.tier}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${scale(b.value)}%`,
                  background:
                    b.tier === "T5"
                      ? "linear-gradient(90deg,#f0b429,#f87171)"
                      : b.tier === "T4"
                        ? "linear-gradient(90deg,#6ba8f5,#4ade9b)"
                        : "#4ade9b",
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted">
              ${b.value < 1 ? b.value.toFixed(3) : b.value.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * Tier ladder graphic. Explains the floor-vs-ceiling distinction visually,
 * which is the single most counterintuitive thing about the router.
 */
export function TierLadder({ className }: { className?: string }) {
  const tiers = [
    { tier: 5, label: "frontier", models: "Opus 5, Astra", tone: "#f0b429" },
    { tier: 4, label: "strong", models: "Sonnet, Sol, V4 Pro", tone: "#6ba8f5" },
    { tier: 3, label: "workhorse", models: "Luna, Flash", tone: "#4ade9b" },
    { tier: 2, label: "cheap", models: "Turbo, Mini", tone: "#34d399" },
    { tier: 1, label: "floor", models: "Qwen Mini", tone: "#6b7688" },
  ];

  return (
    <figure className={className}>
      <figcaption className="mb-4 text-xs text-muted">
        The router picks the <span className="text-accent">cheapest model at the
        required tier</span> — a floor, not a ceiling.
      </figcaption>
      <div className="space-y-2">
        {tiers.map((t) => (
          <div key={t.tier} className="flex items-center gap-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold"
              style={{ background: `${t.tone}1f`, color: t.tone }}
            >
              {t.tier}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{t.label}</div>
              <div className="truncate font-mono text-[10px] text-subtle">
                {t.models}
              </div>
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
