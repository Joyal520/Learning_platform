import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CheckCircle2,
  CirclePlay,
  ClipboardCheck,
  Code2,
  Film,
  FlaskConical,
  Globe2,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  MonitorCog,
  Palette,
  PencilLine,
  Radio,
  Rocket,
  Share2,
  Sparkles,
  Trophy,
  UserRoundCheck,
  Users,
  Video,
  Volume2,
  WandSparkles,
} from "lucide-react";

export type ContentCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type PlatformFeature = ContentCard & {
  detail: string;
  featured?: boolean;
  tone: "blue" | "violet" | "cyan" | "navy";
};

export type LearningPath = ContentCard & {
  code: string;
  tone: "blue" | "violet" | "cyan" | "amber" | "rose" | "navy";
};

export const valueItems: ContentCard[] = [
  { title: "Learn with AI", description: "Use intelligent guidance to understand, practise and improve.", icon: BrainCircuit },
  { title: "Teach with better tools", description: "Plan learning experiences and keep progress visible.", icon: GraduationCap },
  { title: "Create digital projects", description: "Turn knowledge into films, presentations and practical work.", icon: WandSparkles },
  { title: "Share work globally", description: "Build a portfolio and publish meaningful learning outcomes.", icon: Globe2 },
];

export const platformFeatures: PlatformFeature[] = [
  {
    title: "Digital Classroom",
    description: "Manage lessons, assignments and learning activities from one connected workspace.",
    detail: "Lessons • Tasks • Progress",
    icon: LayoutDashboard,
    featured: true,
    tone: "blue",
  },
  {
    title: "Live Quiz",
    description: "Turn lessons into real-time interactive challenges.",
    detail: "Live • Interactive • Focused",
    icon: Radio,
    tone: "cyan",
  },
  {
    title: "Examinations",
    description: "Create, publish and complete structured online assessments.",
    detail: "Create • Publish • Complete",
    icon: ClipboardCheck,
    tone: "navy",
  },
  {
    title: "Competitions",
    description: "Encourage students to solve problems, create projects and compete constructively.",
    detail: "Challenge • Create • Grow",
    icon: Trophy,
    tone: "violet",
  },
  {
    title: "AI Feedback",
    description: "Give learners clear, useful guidance on how to improve their work.",
    detail: "Review • Explain • Improve",
    icon: MessageSquareText,
    featured: true,
    tone: "violet",
  },
  {
    title: "Student Portfolio",
    description: "Help students collect achievements, projects and learning progress.",
    detail: "Projects • Skills • Growth",
    icon: BriefcaseBusiness,
    tone: "blue",
  },
  {
    title: "Leaderboards",
    description: "Recognise participation and improvement through transparent progress systems.",
    detail: "Participation • Progress",
    icon: ChartNoAxesCombined,
    tone: "cyan",
  },
  {
    title: "Learning Resources",
    description: "Access educational videos, worksheets and guided learning materials.",
    detail: "Watch • Read • Practise",
    icon: BookOpen,
    featured: true,
    tone: "navy",
  },
];

export const learningPaths: LearningPath[] = [
  {
    title: "English",
    description: "Build practical communication skills through structured and creative lessons.",
    icon: Languages,
    code: "EN",
    tone: "blue",
  },
  {
    title: "Artificial Intelligence",
    description: "Understand AI tools, prompting, responsible use and real-world applications.",
    icon: Bot,
    code: "AI",
    tone: "violet",
  },
  {
    title: "ICT",
    description: "Develop essential digital skills for study, work and communication.",
    icon: Code2,
    code: "ICT",
    tone: "cyan",
  },
  {
    title: "Robotics",
    description: "Explore electronics, programming and problem-solving through practical projects.",
    icon: MonitorCog,
    code: "RX",
    tone: "amber",
  },
  {
    title: "Digital Creativity",
    description: "Transform ideas into presentations, videos, designs and interactive media.",
    icon: Palette,
    code: "DC",
    tone: "rose",
  },
  {
    title: "AI Filmmaking",
    description: "Learn how to plan, generate, edit and publish meaningful AI-assisted films.",
    icon: Film,
    code: "FILM",
    tone: "navy",
  },
];

export const filmStages: ContentCard[] = [
  { title: "Story development", description: "Shape an idea with purpose, audience and structure.", icon: Lightbulb },
  { title: "Scriptwriting", description: "Turn the concept into scenes, dialogue and direction.", icon: PencilLine },
  { title: "Character consistency", description: "Build coherent characters across every scene.", icon: UserRoundCheck },
  { title: "AI video generation", description: "Create visual sequences with responsible AI workflows.", icon: Sparkles },
  { title: "Voice and sound", description: "Give the story tone, rhythm and an audible identity.", icon: Volume2 },
  { title: "Editing", description: "Refine pacing, continuity, titles and transitions.", icon: Video },
  { title: "Publishing", description: "Prepare the film for the right platform and audience.", icon: Rocket },
  { title: "Student film showcases", description: "Celebrate original work through curated showcases.", icon: CirclePlay },
];

export const audiences = [
  {
    eyebrow: "Learn, practise, create",
    title: "For students",
    description: "Learn at your own pace, complete challenges, receive feedback and build a portfolio of real work.",
    icon: GraduationCap,
    items: ["Interactive lessons", "Quizzes and examinations", "AI-guided feedback", "Creative projects", "Personal portfolio"],
    cta: "Start Learning",
    type: "student" as const,
  },
  {
    eyebrow: "Plan, guide, understand",
    title: "For teachers",
    description: "Plan faster, teach better and manage meaningful digital learning experiences.",
    icon: Users,
    items: ["Digital classroom tools", "Assignment management", "Assessment support", "AI-assisted feedback", "Student progress visibility"],
    cta: "Teach with Edtechra",
    type: "teacher" as const,
  },
];

export const processSteps = [
  { number: "01", title: "Choose a learning path", description: "Start with the subject or skill that matters to you.", icon: FlaskConical },
  { number: "02", title: "Learn through guided content", description: "Follow clear lessons, examples and learning resources.", icon: BookOpen },
  { number: "03", title: "Practise and create", description: "Apply ideas through questions, challenges and projects.", icon: CheckCircle2 },
  { number: "04", title: "Build and share your progress", description: "Collect real work and make growth visible over time.", icon: Share2 },
];

export const heroChips = ["AI Learning", "Digital Classroom", "English", "Robotics", "AI Filmmaking"] as const;

export const dashboardPreviewItems = [
  { label: "Learning progress", value: "English practice", icon: Award },
  { label: "Upcoming activity", value: "Creative AI project", icon: CirclePlay },
  { label: "Quick access", value: "Continue lesson", icon: BookOpen },
];
