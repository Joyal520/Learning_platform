import { processSteps } from "@/landing/config/content";
import { Reveal } from "@/landing/components/ui/Reveal";
import { SectionHeader } from "@/landing/components/ui/SectionHeader";

export function ProcessSection() {
  return (
    <section className="section-pad process-section">
      <div className="section-shell">
        <Reveal>
          <SectionHeader
            eyebrow="A clear learning journey"
            title="How Edtechra works"
            description="Move from curiosity to practical progress through a simple, connected learning process."
          />
        </Reveal>
        <div className="process-grid">
          <div className="process-line" aria-hidden="true"><span /></div>
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.number} delay={index * 0.08} className="process-step">
                <article>
                  <div className="process-marker"><Icon aria-hidden="true" /><span>{step.number}</span></div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
