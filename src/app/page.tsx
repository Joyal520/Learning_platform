import { Hero } from "@/landing/components/hero/Hero";
import { InstallSection } from "@/landing/components/install/InstallSection";
import { Navigation } from "@/landing/components/navigation/Navigation";
import { AudienceSection } from "@/landing/components/sections/AudienceSection";
import { FilmSchool } from "@/landing/components/sections/FilmSchool";
import { FinalCTA } from "@/landing/components/sections/FinalCTA";
import { Footer } from "@/landing/components/sections/Footer";
import { LearningPaths } from "@/landing/components/sections/LearningPaths";
import { PlatformSection } from "@/landing/components/sections/PlatformSection";
import { ProcessSection } from "@/landing/components/sections/ProcessSection";
import { ValueStrip } from "@/landing/components/sections/ValueStrip";
import { SocialSection } from "@/landing/components/social/SocialSection";

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <Hero />
        <ValueStrip />
        <PlatformSection />
        <LearningPaths />
        <FilmSchool />
        <AudienceSection />
        <SocialSection />
        <ProcessSection />
        <InstallSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
