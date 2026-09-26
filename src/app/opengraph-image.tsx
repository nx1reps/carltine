import { ImageResponse } from "next/og";

export const alt = "Carltine — route every LLM call to the cheapest model that can do the job";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Open Graph image, generated at request time.
 *
 * Rendered with the same palette and monospace treatment as the site so a
 * shared link does not look like a different product.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#05070a",
          backgroundImage:
            "radial-gradient(60% 55% at 50% 0%, rgba(74,222,155,0.14), transparent 70%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(74,222,155,0.15)",
              border: "1px solid rgba(74,222,155,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 999, background: "#4ade9b" }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#eef1f6" }}>Carltine</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 600,
              color: "#eef1f6",
              lineHeight: 1.08,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Route every LLM call to the cheapest model that can do the job
          </div>
          <div style={{ fontSize: 30, color: "#4ade9b" }}>
            Open source · bring your own key · provable savings
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "monospace",
            fontSize: 22,
            color: "#6b7688",
          }}
        >
          $ 0.00371 → $ 0.00009 · every decision on a tamper-evident ledger
        </div>
      </div>
    ),
    { ...size },
  );
}
