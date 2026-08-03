type SiteConfig = {
  name: string;
  shortName: string;
  description: string;
  canonicalUrl: string;
  contactEmail: string;
  youtubeUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  studentPortalUrl: string;
  teacherPortalUrl: string;
  programmesUrl: string;
  aiFilmsUrl: string;
};

export const siteConfig: SiteConfig = {
  name: "Edtechra",
  shortName: "Edtechra",
  description:
    "Edtechra is an AI-powered education platform for English, ICT, robotics, digital learning, teacher development and AI filmmaking.",
  canonicalUrl: "", // TODO: Add the production website URL, for example https://www.example.com
  contactEmail: "", // TODO: Add the public Edtechra contact email.
  youtubeUrl: "https://www.youtube.com/@EdTechra",
  facebookUrl: "https://facebook.com/EdTechra", // TODO: Add exact Facebook page URL if different
  instagramUrl: "https://instagram.com/EdTechra", // TODO: Add exact Instagram profile URL if different
  studentPortalUrl: "", // TODO: Add the student portal URL when it is publicly available.
  teacherPortalUrl: "", // TODO: Add the teacher portal URL when it is publicly available.
  programmesUrl: "", // TODO: Add the learning programmes URL when it is available.
  aiFilmsUrl: "", // TODO: Add the AI films showcase URL when it is available.
};

export const navigationLinks = [
  { label: "Home", href: "#home" },
  { label: "Platform", href: "#platform" },
  { label: "Learning", href: "#learning" },
  { label: "AI Film School", href: "#film-school" },
  { label: "For Teachers", href: "#students-teachers" },
  { label: "Community", href: "#community" },
] as const;

export const socialProfiles = [
  {
    key: "youtube",
    name: "YouTube",
    description: "Watch full English lessons, AI explainers, educational documentaries and original AI short films.",
    url: siteConfig.youtubeUrl || "https://www.youtube.com/@EdTechra",
  },
  {
    key: "facebook",
    name: "Facebook",
    description: "Join community discussions, discover educational updates, follow events and receive new platform announcements.",
    url: siteConfig.facebookUrl || "https://facebook.com/EdTechra",
  },
  {
    key: "instagram",
    name: "Instagram",
    description: "Explore short lessons, creative reels, visual learning content and behind-the-scenes Edtechra updates.",
    url: siteConfig.instagramUrl || "https://instagram.com/EdTechra",
  },
] as const;

export const configuredSocialUrls = socialProfiles
  .map((profile) => profile.url)
  .filter((url): url is string => Boolean(url));
