/* The theme: system, light or dark, as a state on <html data-theme>.

   "system" is the absence of the attribute, so the stylesheet's media query
   decides; light and dark are stored so the pre-paint script can apply them
   before anything renders. The same key as v0, so a returning visitor keeps
   their choice across the rebuild. */

export const THEME_KEY = "impromptu.theme";

export type Theme = "system" | "light" | "dark";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** What the document is set to right now. */
export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  return set === "dark" || set === "light" ? set : "system";
}

/** Apply a theme now and remember it, or forget it for "system". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  try {
    if (theme === "system") {
      delete root.dataset.theme;
      localStorage.removeItem(THEME_KEY);
    } else {
      root.dataset.theme = theme;
      localStorage.setItem(THEME_KEY, theme);
    }
  } catch {
    /* Storage can be off; the attribute still took, so the page is right
       until it is reloaded. */
  }
}

/* Runs inline in <head> before first paint, so a dark-theme visitor never
   sees a white flash. Synchronous on purpose. */
export const themeInit =
  `try{var t=localStorage.getItem("${THEME_KEY}");` +
  `if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
