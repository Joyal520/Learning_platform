"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { useEffect, useState } from "react";
import { navigationLinks, siteConfig } from "@/landing/config/site";
import { BrandLogo } from "@/landing/components/ui/BrandLogo";
import { ConfiguredAction } from "@/landing/components/ui/ConfiguredAction";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    const sections = navigationLinks
      .map((link) => document.getElementById(link.href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-28% 0px -58%", threshold: [0.08, 0.2, 0.45] },
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <>
      <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      <header className={`site-header ${scrolled ? "site-header-scrolled" : ""}`}>
        <nav className="nav-shell" aria-label="Main navigation">
          <a href="#home" className="brand-link" aria-label="Edtechra home" onClick={() => setOpen(false)}>
            <BrandLogo priority className="nav-logo" />
          </a>
          <div className="desktop-nav">
            {navigationLinks.map((link) => {
              const id = link.href.slice(1);
              return (
                <a key={link.href} href={link.href} className={activeSection === id ? "active" : ""}>
                  {link.label}
                </a>
              );
            })}
          </div>
          <div className="nav-actions">
            <a href="/home" className="button button-nav-secondary">Try EdTechra</a>
            <a href="#install" className="button button-nav-primary">Install App</a>
          </div>
          <button type="button" className="mobile-menu-button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </nav>
        <AnimatePresence>
          {open ? (
            <motion.div id="mobile-navigation" className="mobile-navigation" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {navigationLinks.map((link) => (
                <a key={link.href} href={link.href} className={activeSection === link.href.slice(1) ? "active" : ""} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              ))}
              <a href="/home" className="button button-secondary" onClick={() => setOpen(false)}>Try EdTechra</a>
              <a href="#install" className="button button-primary" onClick={() => setOpen(false)}>Install App</a>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
    </>
  );
}
