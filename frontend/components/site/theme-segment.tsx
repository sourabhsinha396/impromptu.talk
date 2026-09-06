"use client";

import { useEffect, useState } from "react";

import { AutoThemeIcon, MoonIcon, SunIcon } from "@/components/site/icons";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/* Three stops shown at once, so the control states the choice rather than
   cycling through it. It reads the document rather than storage, because
   the pre-paint script has already applied the stored choice by the time
   this mounts, and the document is what the visitor is looking at. */
const STOPS: { value: Theme; label: string; title: string; Icon: typeof SunIcon }[] = [
  { value: "system", label: "Auto", title: "Follow your system theme", Icon: AutoThemeIcon },
  { value: "light", label: "Light", title: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", title: "Dark", Icon: MoonIcon },
];

export function ThemeSegment({ className }: { className?: string }) {
  /* Starts on system and corrects after mount: the server does not know
     the visitor's choice, and a mismatch here is a hydration warning. */
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(currentTheme()), []);

  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("grid grid-cols-3 gap-0.5 rounded-[10px] border border-line bg-card2 p-0.5", className)}
    >
      {STOPS.map(({ value, label, title, Icon }) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            title={title}
            aria-pressed={on}
            onClick={() => choose(value)}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold",
              "text-muted transition-colors hover:text-ink",
              on && "bg-card text-ink shadow-sm",
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
