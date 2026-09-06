import type { ComponentType } from "react";

import {
  ArrowLeft,
  Banknote,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Check,
  ChevronDown,
  Clapperboard,
  Coffee,
  Dices,
  Dumbbell,
  Flame,
  Gift,
  Globe,
  GraduationCap,
  HandCoins,
  Heart,
  Lightbulb,
  LogOut,
  type LucideProps,
  Mail,
  MessageCircle,
  Mic,
  Microscope,
  Moon,
  Music,
  NotebookPen,
  Palette,
  Pause,
  PawPrint,
  Pencil,
  Play,
  Plane,
  Plus,
  Rocket,
  RotateCw,
  Scale,
  Scroll,
  Settings,
  Shuffle,
  Sparkles,
  Sprout,
  Sun,
  SunMoon,
  Target,
  Trophy,
  User,
  Utensils,
  X,
  Zap,
} from "lucide-react";

/* lucide only, mapped by meaning. Nothing on the site is an emoji: every
   one v0 drew (the genre marks, the five styles, the badges a person picks
   for their own genre, the operator tool cards, the chrome glyphs) is a
   glyph here, drawn on the same 24-unit grid at the same 2-unit stroke, so
   they weigh the same beside each other.

   Names are mapped here rather than imported at each call site, for two
   reasons. Which glyph stands for a style is a product decision, so it is
   one line to change here instead of a sweep. And the names say what the
   icon is for: `RotateIcon` survives a rename in lucide's catalogue, which
   `RotateCw` does not. */

type Glyph = ComponentType<LucideProps>;
type IconProps = LucideProps & { size?: number };

/* lucide defaults to 24. Most call sites pass their own size; this only
   matters for one that forgets. */
function icon(Glyph: Glyph) {
  return function Icon({ size = 16, ...rest }: IconProps) {
    return <Glyph size={size} aria-hidden {...rest} />;
  };
}

/* The chrome. */
export const SettingsIcon = icon(Settings);
export const AccountIcon = icon(User);
export const FlameIcon = icon(Flame);
export const BackIcon = icon(ArrowLeft);
export const RotateIcon = icon(RotateCw);
export const EditIcon = icon(Pencil);
export const SunIcon = icon(Sun);
export const MoonIcon = icon(Moon);
export const AutoThemeIcon = icon(SunMoon);
export const ChevronDownIcon = icon(ChevronDown);
export const PlusIcon = icon(Plus);
export const CheckIcon = icon(Check);
export const CloseIcon = icon(X);
export const SignOutIcon = icon(LogOut);
export const PauseIcon = icon(Pause);
export const PlayIcon = icon(Play);

/* The glyphs a genre may wear, keyed by lucide's own slug so the stored
   value reads as what it draws. The seeder writes one for each built-in
   genre; a person picks one for their own. A fixed set rather than free
   text, because the value is rendered on a page and the one thing it must
   never be is whatever was posted; the backend keeps the same 26 and
   validates against them. */
export const ICONS: Record<string, Glyph> = {
  sparkles: Sparkles,
  dices: Dices,
  coffee: Coffee,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  "notebook-pen": NotebookPen,
  mic: Mic,
  bot: Bot,
  microscope: Microscope,
  banknote: Banknote,
  rocket: Rocket,
  scale: Scale,
  brain: Brain,
  heart: Heart,
  utensils: Utensils,
  plane: Plane,
  globe: Globe,
  dumbbell: Dumbbell,
  sprout: Sprout,
  scroll: Scroll,
  clapperboard: Clapperboard,
  music: Music,
  trophy: Trophy,
  palette: Palette,
  "paw-print": PawPrint,
  flame: Flame,
};

export const DEFAULT_ICON = "sparkles";

/** One we offer, or the default. */
export function validIcon(value: string | null | undefined): string {
  return value !== null && value !== undefined && value in ICONS ? value : DEFAULT_ICON;
}

export function GenreIcon({ icon: slug, ...rest }: IconProps & { icon: string | null | undefined }) {
  const Glyph = icon(ICONS[validIcon(slug)]);
  return <Glyph {...rest} />;
}

/* One glyph per style, how a prompt asks you to talk (v0 called it the
   format). Hot take is a bolt rather than a flame, because the flame is the
   streak's mark and a header with two flames says nothing. */
export const STYLE_ICONS: Record<string, Glyph> = {
  surprise: Shuffle,
  "just-talk": MessageCircle,
  "hot-take": Zap,
  explain: Lightbulb,
  story: BookOpen,
};

export function StyleIcon({ style, ...rest }: IconProps & { style: string }) {
  const Glyph = icon(STYLE_ICONS[style] ?? Shuffle);
  return <Glyph {...rest} />;
}

/* The operator tool cards on /administration, keyed by tool slug. */
export const TOOL_ICONS: Record<string, Glyph> = {
  "staged-topic": Target,
  pro: Gift,
  payouts: HandCoins,
  outreach: Mail,
};

export function ToolIcon({ slug, ...rest }: IconProps & { slug: string }) {
  const Glyph = icon(TOOL_ICONS[slug] ?? Settings);
  return <Glyph {...rest} />;
}
