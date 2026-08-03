import { ArrowRight, Download } from "lucide-react";
import { Reveal } from "@/landing/components/ui/Reveal";

export function FinalCTA() {
  return (
    <section className="final-cta-section">
      <div className="section-shell">
        <Reveal className="final-cta-shell">
          <div className="final-cta-grid" aria-hidden="true" />
          <div className="final-cta-orb final-cta-orb-one" aria-hidden="true" />
          <div className="final-cta-orb final-cta-orb-two" aria-hidden="true" />
          <p className="eyebrow">Learn. Teach. Create.</p>
          <h2>Education should not only prepare people for the future. It should help them create it.</h2>
          <p>Join Edtechra and begin learning, teaching and creating with modern digital tools.</p>
          <div className="final-cta-actions">
            <a href="/home" className="button button-primary">Try EdTechra <ArrowRight size={18} aria-hidden="true" /></a>
            <a href="#install" className="button button-secondary">
              <Download size={18} aria-hidden="true" /> Install App
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
