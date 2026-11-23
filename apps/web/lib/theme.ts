export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "theme";

/**
 * Runs in <head> before first paint (see app/layout.tsx) so a saved theme never flashes.
 * "System" leaves data-theme off and lets the CSS media query in globals.css decide.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
