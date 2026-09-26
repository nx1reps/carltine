/**
 * JSON-LD structured data.
 *
 * Emitted on the marketing pages so search engines can render the software
 * product, FAQ, and organisation entities rather than guessing. The FAQ
 * entries are kept in sync with the visible accordion by importing the same
 * list, which is the only way to avoid the usual failure mode of structured data
 * drifting away from the page.
 */

export function StructuredData({
  faq = [],
  includeSoftware = false,
}: {
  faq?: readonly { q: string; a: string }[];
  includeSoftware?: boolean;
}) {
  const graph: unknown[] = [
    {
      "@type": "Organization",
      "@id": "https://carltine.com/#organization",
      name: "Carltine",
      url: "https://carltine.com",
      logo: "https://carltine.com/icon.svg",
      description:
        "Open-source LLM router with a tamper-evident audit trail.",
    },
  ];

  if (includeSoftware) {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": "https://carltine.com/#software",
      name: "Carltine",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      description:
        "Routes each LLM request to the cheapest model that can handle it, and records every decision to a tamper-evident ledger.",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Self-hosted" },
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Cloud free tier" },
        { "@type": "Offer", price: "49", priceCurrency: "USD", name: "Team" },
      ],
    });
  }

  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": "https://carltine.com/#faq",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      // Content is a static, developer-authored object literal — no user input
      // reaches this string, so JSON.stringify cannot inject markup here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
