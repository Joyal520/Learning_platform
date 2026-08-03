"use client";

import { ArrowDownRight, Download, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";
import { heroChips } from "@/landing/config/content";
import { HeroShowcase } from "./HeroShowcase";

export function Hero() {
  return (
    <section id="home" className="hero-section section-anchor">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow hero-glow-one" aria-hidden="true" />
      <div className="hero-glow hero-glow-two" aria-hidden="true" />
      <div className="hero-particles" aria-hidden="true">
        <span className="particle particle-1" />
        <span className="particle particle-2" />
        <span className="particle particle-3" />
        <span className="particle particle-4" />
        <span className="particle particle-5" />
      </div>
      <div className="section-shell hero-layout">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero-eyebrow"><Sparkles size={16} aria-hidden="true" /> AI-powered learning for students, teachers and creators</div>
          <h1>Learn smarter. Teach better. <span>Create the future.</span></h1>
          <p className="hero-description">
            Edtechra brings AI, English, ICT, robotics, digital learning and creative media into one connected educational platform.
          </p>
          <div className="hero-actions">
            <a href="/home" className="button button-primary button-hero-primary">Try EdTechra <ArrowDownRight size={18} aria-hidden="true" /></a>
            <a href="#install" className="button button-secondary button-hero-secondary">
              <Download size={17} aria-hidden="true" /> Install App
            </a>
          </div>
          <motion.div
            className="hero-social-proof"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="social-proof-avatars">
              <span className="avatar-dot avatar-dot-1" />
              <span className="avatar-dot avatar-dot-2" />
              <span className="avatar-dot avatar-dot-3" />
            </div>
            <p>Built for modern classrooms, independent learners and future creators.</p>
          </motion.div>
          <div className="hero-chips" aria-label="Edtechra learning areas">
            {heroChips.map((chip, index) => (
              <motion.span
                key={chip}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + index * 0.06, duration: 0.38 }}
              >
                {chip}
              </motion.span>
            ))}
          </div>
        </motion.div>
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, x: 28, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroShowcase />
        </motion.div>
      </div>
    </section>
  );
}
