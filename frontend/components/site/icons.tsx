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
  PawPrint,
  Pencil,
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
   one v0 drew (ten genres, five formats, the pack badges, the operator tool
   cards, the chrome glyphs) is a glyph here, drawn on the same 24-unit grid
   at the same 2-unit stroke, so they weigh the same beside each other.

   Names are mapped here rather than imported at each call site, for two
   reasons. Which glyph stands for a genre is a product decision, so it is
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

/* One glyph per genre, keyed by the slug the bank uses. The ten are fixed,
   so the glyph is a function of the slug and the genre table carries no
   icon column. */
export const GENRE_ICONS: Record<string, Glyph> = {
  general: Dices,
  "everyday-life": Coffee,
  relationships: Heart,
  career: Briefcase,
  "money-business": Banknote,
  "tech-ai": Bot,
  science: Microscope,
  health: Dumbbell,
  philosophy: Brain,
  culture: Clapperboard,
};

export function GenreIcon({ slug, ...rest }: IconProps & { slug: string }) {
  const Glyph = icon(GENRE_ICONS[slug] ?? Dices);
  return <Glyph {...rest} />;
}

/* One glyph per category, the kind of talk a prompt asks for (v0 called it
   the format). Hot take is a bolt rather than a flame, because the flame is
   the streak's mark and a header with two flames says nothing. */
export const CATEGORY_ICONS: Record<string, Glyph> = {
  surprise: Shuffle,
  "just-talk": MessageCircle,
  "hot-take": Zap,
  explain: Lightbulb,
  story: BookOpen,
};

export function CategoryIcon({ category, ...rest }: IconProps & { category: string }) {
  const Glyph = icon(CATEGORY_ICONS[category] ?? Shuffle);
  return <Glyph {...rest} />;
}

/* The badges a pack can wear, keyed by lucide's own slug so the stored
   value reads as what it draws. A fixed set rather than free text, because
   the value is rendered on a page and the one thing it must never be is
   whatever was posted; the pack API validates against this list. */
export const PACK_ICONS: Record<string, Glyph> = {
  sparkles: Sparkles,
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

export const DEFAULT_PACK_ICON = "sparkles";

/** One we offer, or the default. */
export function validPackIcon(value: string | null | undefined): string {
  return value !== null && value !== undefined && value in PACK_ICONS ? value : DEFAULT_PACK_ICON;
}

export function PackIcon({ icon: slug, ...rest }: IconProps & { icon: string | null | undefined }) {
  const Glyph = icon(PACK_ICONS[validPackIcon(slug)]);
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
