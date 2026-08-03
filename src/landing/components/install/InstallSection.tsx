"use client";

import { BookOpen, CalendarDays, Check, ChevronRight, Download, Gauge, Share, Smartphone } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { dashboardPreviewItems } from "@/landing/config/content";
import { useInstallPrompt } from "@/landing/hooks/useInstallPrompt";
import { Modal } from "@/landing/components/ui/Modal";

type HelpModal = "ios" | "fallback" | null;

export function InstallSection() {
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();
  const [modal, setModal] = useState<HelpModal>(null);

  const handleInstall = async () => {
    if (isIOS) {
      setModal("ios");
      return;
    }
    if (canInstall) {
      await install();
      return;
    }
    setModal("fallback");
  };

  return (
    <section id="install" className="section-pad section-anchor install-section">
      <div className="section-shell install-shell">
        <div className="install-copy">
          <p className="eyebrow">Installable learning</p>
          <h2>Take Edtechra with you</h2>
          <p>Install the Edtechra app for faster access to learning tools, courses and creative activities.</p>
          <ul>
            <li><Check aria-hidden="true" /> Launch from your home screen</li>
            <li><Check aria-hidden="true" /> Keep learning tools close at hand</li>
            <li><Check aria-hidden="true" /> Enjoy a focused app-like experience</li>
          </ul>
          {isInstalled ? (
            <div className="installed-state" role="status"><Check aria-hidden="true" /> Edtechra is installed on this device</div>
          ) : (
            <button type="button" className={canInstall || isIOS ? "button button-primary" : "button button-secondary"} onClick={handleInstall}>
              {canInstall || isIOS ? <Download aria-hidden="true" size={18} /> : <Smartphone aria-hidden="true" size={18} />}
              {canInstall || isIOS ? "Install Edtechra" : "View installation help"}
            </button>
          )}
          <p className="install-note">
            {canInstall
              ? "Installation is supported in this browser."
              : isIOS
                ? "On iPhone and iPad, add Edtechra from the browser Share menu."
                : "Automatic installation appears only when the browser and device support it."}
          </p>
        </div>
        <div className="app-preview" aria-label="Preview of the Edtechra mobile dashboard">
          <div className="app-preview-aura" aria-hidden="true" />
          <div className="phone-shell">
            <div className="phone-speaker" />
            <div className="phone-content">
              <div className="phone-header">
                <Image src="/brand/edtechra-symbol.png" width={40} height={40} sizes="40px" alt="" />
                <div><span>Welcome back</span><strong>Your learning dashboard</strong></div>
              </div>
              <div className="progress-card">
                <div><Gauge aria-hidden="true" /><span>Learning progress</span></div>
                <strong>Continue where you left off</strong>
                <div className="progress-track"><span /></div>
              </div>
              <div className="phone-list">
                {dashboardPreviewItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="phone-list-item">
                      <div className="phone-list-icon"><Icon aria-hidden="true" /></div>
                      <div><span>{item.label}</span><strong>{item.value}</strong></div>
                      <ChevronRight aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
              <div className="phone-nav"><BookOpen aria-hidden="true" /><CalendarDays aria-hidden="true" /><Smartphone aria-hidden="true" /></div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal === "ios"} title="Install Edtechra on iPhone or iPad" onClose={() => setModal(null)}>
        <ol className="install-steps">
          <li><span>1</span><div><strong>Open the Share menu</strong><p>Tap the <Share size={16} aria-hidden="true" /> Share icon in Safari.</p></div></li>
          <li><span>2</span><div><strong>Choose Add to Home Screen</strong><p>Scroll the action list if the option is not immediately visible.</p></div></li>
          <li><span>3</span><div><strong>Confirm the app name</strong><p>Tap Add to place Edtechra on your home screen.</p></div></li>
        </ol>
        <button type="button" className="button button-primary modal-action" onClick={() => setModal(null)}>Got it</button>
      </Modal>

      <Modal open={modal === "fallback"} title="Install Edtechra from your browser" onClose={() => setModal(null)}>
        <div className="modal-copy">
          <p>This browser has not exposed automatic installation. You can still check the browser menu for an option such as <strong>Install app</strong>, <strong>Add to home screen</strong>, or <strong>Create shortcut</strong>.</p>
          <p>Installation availability can depend on your browser, operating system and whether the site is served securely.</p>
        </div>
        <button type="button" className="button button-primary modal-action" onClick={() => setModal(null)}>Close help</button>
      </Modal>
    </section>
  );
}
