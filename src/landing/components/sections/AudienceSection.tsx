import { ArrowRight, CheckCircle2 } from "lucide-react";
import { audiences } from "@/landing/config/content";
import { siteConfig } from "@/landing/config/site";
import { ConfiguredAction } from "@/landing/components/ui/ConfiguredAction";
import { Reveal } from "@/landing/components/ui/Reveal";

export function AudienceSection() {
  return (
    <section id="students-teachers" className="section-pad section-anchor audience-section">
      <div className="section-shell audience-grid">
        {audiences.map((audience, index) => {
          const Icon = audience.icon;
          const url = audience.type === "student" ? siteConfig.studentPortalUrl : siteConfig.teacherPortalUrl;
          return (
            <Reveal key={audience.title} delay={index * 0.08} className={`audience-card audience-card-${audience.type}`}>
              <article>
                <div className="audience-icon"><Icon aria-hidden="true" /></div>
                <p className="eyebrow">{audience.eyebrow}</p>
                <h2>{audience.title}</h2>
                <p className="audience-description">{audience.description}</p>
                <ul>
                  {audience.items.map((item) => <li key={item}><CheckCircle2 aria-hidden="true" /> {item}</li>)}
                </ul>
                <ConfiguredAction href={url} className={audience.type === "student" ? "button button-primary" : "button button-light"}>
                  {audience.cta} <ArrowRight size={18} aria-hidden="true" />
                </ConfiguredAction>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
