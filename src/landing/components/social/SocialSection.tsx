import { ArrowUpRight } from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { socialProfiles } from "@/landing/config/site";
import { SectionHeader } from "@/landing/components/ui/SectionHeader";

const platformPresentation = {
  youtube: { icon: FaYoutube, cta: "Visit YouTube" },
  facebook: { icon: FaFacebookF, cta: "Follow on Facebook" },
  instagram: { icon: FaInstagram, cta: "Follow on Instagram" },
} as const;

export function SocialSection() {
  return (
    <section id="community" className="section-pad section-anchor social-section">
      <div className="social-background-grid" aria-hidden="true" />
      <div className="section-shell social-content">
        <div>
          <SectionHeader
            eyebrow="Community & social media"
            title="Stay Connected with Edtechra"
            description="Follow our learning community for English lessons, AI education, creative resources, platform updates and original AI short films."
          />
        </div>
        <div className="social-grid">
          {socialProfiles.map((profile) => {
            const presentation = platformPresentation[profile.key];
            const Icon = presentation.icon;
            const targetUrl = profile.url || (profile.key === "youtube" ? "https://www.youtube.com/@EdTechra" : profile.key === "facebook" ? "https://facebook.com" : "https://instagram.com");
            return (
              <div key={profile.name} className={`social-card social-card-${profile.key}`}>
                <article>
                  <div className="social-card-glow" aria-hidden="true" />
                  <div className={`social-icon social-icon-${profile.key}`}><Icon aria-hidden="true" /></div>
                  <div className="social-card-copy">
                    <h3>{profile.name}</h3>
                    <p>{profile.description}</p>
                  </div>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`social-cta social-cta-${profile.key}`}
                    aria-label={`${presentation.cta} in a new tab`}
                  >
                    <span>{presentation.cta}</span><ArrowUpRight aria-hidden="true" />
                  </a>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
