import { ArrowUpRight, Check } from "lucide-react";
import { platformFeatures } from "@/landing/config/content";
import { Reveal } from "@/landing/components/ui/Reveal";
import { SectionHeader } from "@/landing/components/ui/SectionHeader";

function FeatureDetail({ tone, featured }: { tone: string; featured?: boolean }) {
  if (featured) {
    return (
      <div className={`feature-ui feature-ui-${tone}`} aria-hidden="true">
        <div className="feature-ui-top"><span /><span /><span /></div>
        <div className="feature-ui-layout">
          <div className="feature-ui-side" />
          <div className="feature-ui-main"><span /><span /><span /></div>
        </div>
      </div>
    );
  }
  return (
    <div className={`feature-meter feature-meter-${tone}`} aria-hidden="true">
      <span /><span /><span /><Check size={15} />
    </div>
  );
}

export function PlatformSection() {
  return (
    <section id="platform" className="section-pad section-anchor platform-section">
      <div className="section-shell">
        <Reveal>
          <SectionHeader
            eyebrow="The Edtechra platform"
            title="One platform. Many ways to learn."
            description="From classroom activities to examinations and creative projects, Edtechra helps learners move from passive study to active creation."
          />
        </Reveal>
        <div className="platform-grid">
          {platformFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.title}
                delay={(index % 4) * 0.05}
                className={`platform-card platform-card-${feature.tone} ${feature.featured ? "platform-card-featured" : ""}`}
              >
                <article tabIndex={0}>
                  <div className="platform-card-heading">
                    <div className="platform-icon"><Icon aria-hidden="true" /></div>
                    <ArrowUpRight className="platform-arrow" aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                  <FeatureDetail tone={feature.tone} featured={feature.featured} />
                  <span className="platform-detail">{feature.detail}</span>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
