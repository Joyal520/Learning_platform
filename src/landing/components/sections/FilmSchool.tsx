"use client";

import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Lightbulb,
  PanelsTopLeft,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaYoutube } from "react-icons/fa";
import { siteConfig } from "@/landing/config/site";
import { useReducedMotion } from "@/landing/hooks/useReducedMotion";
import { SectionHeader } from "@/landing/components/ui/SectionHeader";
import { FilmPreviewPlayer } from "./FilmPreviewPlayer";

const storyboardFrames = [
  { scene: "Scene 01", label: "Rain street", visual: "city" },
  { scene: "Scene 02", label: "Window", visual: "window" },
  { scene: "Scene 03", label: "Empty chair", visual: "chair" },
  { scene: "Scene 04", label: "Into the fog", visual: "fog" },
  { scene: "Scene 05", label: "First light", visual: "sunrise" },
] as const;

const workflow = [
  { label: "Idea", icon: Lightbulb },
  { label: "Script", icon: FileText },
  { label: "Storyboard", icon: PanelsTopLeft },
  { label: "Generate", icon: Sparkles },
  { label: "Edit", icon: SlidersHorizontal },
  { label: "Publish", icon: UploadCloud },
] as const;

function StoryboardVisual({ visual }: { visual: (typeof storyboardFrames)[number]["visual"] }) {
  return (
    <div className={`studio-thumb studio-thumb-${visual}`} aria-hidden="true">
      {visual === "city" ? <><i className="city-block city-block-one" /><i className="city-block city-block-two" /><i className="city-light city-light-one" /><i className="city-light city-light-two" /></> : null}
      {visual === "window" ? <><i className="window-frame" /><i className="window-person" /><i className="window-rain" /></> : null}
      {visual === "chair" ? <><i className="chair-light" /><i className="chair-seat" /><i className="chair-leg chair-leg-one" /><i className="chair-leg chair-leg-two" /></> : null}
      {visual === "fog" ? <><i className="fog-layer" /><i className="fog-person" /><i className="fog-path" /></> : null}
      {visual === "sunrise" ? <><i className="sunrise-light" /><i className="sunrise-land sunrise-land-one" /><i className="sunrise-land sunrise-land-two" /></> : null}
    </div>
  );
}

export function FilmSchool() {
  const reducedMotion = useReducedMotion();
  const [selectedScene, setSelectedScene] = useState(3);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setSelectedScene((current) => (current === 3 ? 4 : 3));
    }, 4500);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const exploreHref = siteConfig.aiFilmsUrl || "#film-workspace";

  return (
    <section id="film-school" className="section-pad section-anchor film-section">
      <div className="section-shell film-intro">
        <div className="film-copy">
          <SectionHeader
            align="left"
            eyebrow="Edtechra AI Short Film School"
            title={<>Stories created with AI.<br />Skills built for the future.</>}
            description="Edtechra’s AI Short Film School helps students and creators turn meaningful ideas into scripts, visual scenes, animations and publishable films."
          />
          <div className="film-actions">
            <a
              href={exploreHref}
              className="button button-primary film-primary-action"
              {...(siteConfig.aiFilmsUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              Explore AI Films <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              href="https://www.youtube.com/@EdTechra"
              target="_blank"
              rel="noopener noreferrer"
              className="button film-youtube-action"
            >
              <FaYoutube aria-hidden="true" /> Visit YouTube Channel <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div id="film-workspace" className="film-workspace" aria-label="AI filmmaking production workspace">
          <div className="studio-topbar">
            <div><span className="studio-status-dot" aria-hidden="true" /> AI Film Workspace</div>
            <strong>The Last Light</strong>
            <span>Scene 04 · Shot 02</span>
          </div>

          <div className="studio-main">
            <div className="studio-preview-column">
              <div className="cinematic-monitor">
                <FilmPreviewPlayer />
                <div className="monitor-label"><span>REC 709</span><span>4K · 24 FPS</span></div>
              </div>
              <div className="production-info" aria-label="Scene production information">
                <span><Clock3 aria-hidden="true" /> <b>Duration</b> 8 sec</span>
                <span><Camera aria-hidden="true" /> <b>Camera</b> Slow push-in</span>
                <span className="production-mood"><i aria-hidden="true" /> <b>Mood</b> Emotional</span>
                <span className="production-generated"><CheckCircle2 aria-hidden="true" /> Generated</span>
              </div>
            </div>

            <aside className="grading-panel" aria-label="Colour grading controls">
              <div className="grading-title"><SlidersHorizontal aria-hidden="true" /><span>Colour</span></div>
              {[
                ["Temp", "68%", "grading-warm"],
                ["Tint", "42%", "grading-violet"],
                ["Light", "56%", "grading-cyan"],
                ["Grain", "28%", "grading-neutral"],
              ].map(([label, value, className]) => (
                <div className="grading-control" key={label}>
                  <div><span>{label}</span><b>{value}</b></div>
                  <div className={`grading-track ${className}`}><span style={{ width: value }} /></div>
                </div>
              ))}
              <div className="grading-curve" aria-hidden="true"><span /><i /><b /></div>
            </aside>
          </div>

          <div className="storyboard-heading">
            <div><PanelsTopLeft aria-hidden="true" /><span>Storyboard timeline</span></div>
            <span>5 scenes · 00:42</span>
          </div>
          <div className="studio-storyboard" role="list" aria-label="Five-scene film storyboard">
            {storyboardFrames.map((frame, index) => (
              <div key={frame.scene} role="listitem" className={`studio-story-frame ${selectedScene === index ? "is-selected" : ""}`}>
                <StoryboardVisual visual={frame.visual} />
                <div><span>{frame.scene}</span><strong>{frame.label}</strong></div>
              </div>
            ))}
          </div>
          <div className="studio-timeline-progress" aria-hidden="true">
            <motion.span
              initial={false}
              animate={reducedMotion ? { scaleX: 0.72 } : { scaleX: [0, 1, 0] }}
              transition={reducedMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: "linear" }}
            />
            <i />
          </div>

          <div className="studio-workflow" aria-label="Film production workflow">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              const current = index === 3 || index === 4;
              return (
                <div key={step.label} className={`${index < 3 ? "is-complete" : ""} ${current ? "is-current" : ""}`}>
                  <span><Icon aria-hidden="true" /></span>
                  <b>{step.label}</b>
                  {index < workflow.length - 1 ? <i aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
