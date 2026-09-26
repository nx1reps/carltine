import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features, HowItWorks, Proof, Stats, Moat } from "@/components/landing/sections";
import { Pricing, Faq, Cta, FAQS } from "@/components/landing/pricing-faq";
import { Graphics } from "@/components/landing/graphics";
import { StructuredData } from "@/components/structured-data";

export default function LandingPage() {
  return (
    <>
      <StructuredData faq={FAQS} includeSoftware />
      <SiteHeader />
      <main>
        <Hero />
        <div id="features">
          <Features />
        </div>
        <Stats />
        <Graphics />
        <div id="how">
          <HowItWorks />
        </div>
        <Proof />
        <Moat />
        <div id="pricing">
          <Pricing />
        </div>
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
