import { valueItems } from "@/landing/config/content";
import { Reveal } from "@/landing/components/ui/Reveal";

export function ValueStrip() {
  return (
    <section aria-label="Edtechra value proposition" className="value-strip-section">
      <div className="section-shell value-strip">
        {valueItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.title} className="value-item" delay={index * 0.07}>
              <div className="value-icon"><Icon aria-hidden="true" /></div>
              <div><h2>{item.title}</h2><p>{item.description}</p></div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
