import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carltine — LLM Router",
    short_name: "Carltine",
    description:
      "Route every LLM call to the cheapest model that can do the job, with a tamper-evident audit trail.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070a",
    theme_color: "#4ade9b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
