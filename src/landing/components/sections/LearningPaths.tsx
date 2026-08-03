import { learningPaths } from "@/landing/config/content";
import { Reveal } from "@/landing/components/ui/Reveal";
import { SectionHeader } from "@/landing/components/ui/SectionHeader";

function PathVisual({ code, tone }: { code: string; tone: string }) {
  return (
    <div className={`path-visual path-visual-${tone}`} aria-hidden="true">
      <span className="path-code">{code}</span>
      <span className="path-node path-node-one" />
      <span className="path-node path-node-two" />
      <span className="path-node path-node-three" />
      <span className="path-line path-line-one" />
      <span className="path-line path-line-two" />
    </div>
  );
}

export function LearningPaths() {
  return (
    <section id="learning" className="section-pad section-anchor learning-section">
      <div className="section-shell">
        <Reveal>
          <SectionHeader
            eyebrow="Programmes with purpose"
            title="Learning paths for the future"
            description="Build practical foundations, understand emerging technology and turn new knowledge into meaningful work."
          />
        </Reveal>
        <div className="learning-grid">
          {learningPaths.map((path, index) => {
            const Icon = path.icon;
            return (
              <Reveal key={path.title} delay={(index % 3) * 0.06} className={`learning-card learning-card-${path.tone}`}>
                <article>
                  <div className="learning-card-top">
                    <div className="learning-icon"><Icon aria-hidden="true" /></div>
                    <span>Learning path</span>
                  </div>
                  <PathVisual code={path.code} tone={path.tone} />
                  <h3>{path.title}</h3>
                  <p>{path.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
