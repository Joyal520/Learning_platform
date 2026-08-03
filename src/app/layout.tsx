import "@fontsource-variable/manrope/wght.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/landing/components/install/ServiceWorkerRegistrar";
import { StandaloneRedirect } from "@/landing/components/install/StandaloneRedirect";
import { configuredSocialUrls, siteConfig } from "@/landing/config/site";
import "./globals.css";

const title = "Edtechra | Learn Smarter. Teach Better. Create the Future.";
const canonical = siteConfig.canonicalUrl || undefined;

export const metadata: Metadata = {
  title,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/edtechra-app-icon.png",
    apple: "/brand/edtechra-app-icon.png",
  },
  alternates: canonical ? { canonical } : undefined,
  openGraph: {
    title,
    description: siteConfig.description,
    type: "website",
    siteName: siteConfig.name,
    url: canonical,
    images: canonical ? [{ url: "/brand/edtechra-wordmark.png", width: 1540, height: 483, alt: "Edtechra" }] : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteConfig.description,
    images: canonical ? ["/brand/edtechra-wordmark.png"] : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#001040",
  colorScheme: "light",
};

const organisationData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  description: siteConfig.description,
  ...(canonical ? { url: canonical, logo: `${canonical.replace(/\/$/, "")}/brand/edtechra-wordmark.png` } : {}),
  ...(configuredSocialUrls.length ? { sameAs: configuredSocialUrls } : {}),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
        <StandaloneRedirect />
        <ServiceWorkerRegistrar />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationData) }} />
      </body>
    </html>
  );
}
