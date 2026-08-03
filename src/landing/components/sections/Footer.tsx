import { Mail } from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { navigationLinks, siteConfig } from "@/landing/config/site";
import { BrandLogo } from "@/landing/components/ui/BrandLogo";

const learningLinks = [
  { label: "English", href: "#learning" },
  { label: "Artificial Intelligence", href: "#learning" },
  { label: "ICT & Robotics", href: "#learning" },
  { label: "AI Filmmaking", href: "#film-school" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  const socialLinks = [
    { label: "YouTube", href: siteConfig.youtubeUrl || "https://www.youtube.com/@EdTechra", icon: FaYoutube },
    { label: "Facebook", href: siteConfig.facebookUrl || "https://facebook.com/EdTechra", icon: FaFacebookF },
    { label: "Instagram", href: siteConfig.instagramUrl || "https://instagram.com/EdTechra", icon: FaInstagram },
  ];

  return (
    <footer className="site-footer">
      <div className="section-shell footer-grid">
        <div className="footer-brand">
          <a href="#home" aria-label="Edtechra home"><BrandLogo className="footer-logo" /></a>
          <p>AI-powered education and creative learning for students, teachers and future creators.</p>
          <strong>Learn smarter. Teach better. Create the future.</strong>
        </div>
        <div className="footer-column">
          <h2>Platform</h2>
          {navigationLinks.slice(1, 4).map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          <a href="#install">Install app</a>
        </div>
        <div className="footer-column">
          <h2>Learning</h2>
          {learningLinks.map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
        </div>
        <div className="footer-column">
          <h2>Teachers & community</h2>
          <a href="#students-teachers">For teachers</a>
          <a href="#community">Social ecosystem</a>
          <a href="#film-school">Film school</a>
          {siteConfig.contactEmail ? (
            <a href={`mailto:${siteConfig.contactEmail}`}><Mail size={15} aria-hidden="true" /> Contact Edtechra</a>
          ) : (
            <span className="footer-placeholder"><Mail size={15} aria-hidden="true" /> Contact details coming soon</span>
          )}
        </div>
      </div>
      <div className="section-shell footer-bottom">
        <p>© {year} Edtechra. All rights reserved.</p>
        <div className="footer-socials" aria-label="Edtechra social profiles">
          {socialLinks.map(({ label, href, icon: Icon }) => href ? (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Edtechra on ${label}`}><Icon aria-hidden="true" /></a>
          ) : (
            <span key={label} aria-label={`${label} link coming soon`} title={`${label} link coming soon`}><Icon aria-hidden="true" /></span>
          ))}
        </div>
        <div className="footer-legal"><span>Privacy (coming soon)</span><span>Terms (coming soon)</span></div>
      </div>
    </footer>
  );
}
