// Light/dark display theme ("מצב כהה"). The choice lives in users.theme (so
// it follows the user across devices; lib/theme-store.ts), mirrored in a
// cookie (server render without a flash, also before sign-in) and in
// localStorage. With no choice at all, the device's prefers-color-scheme
// decides (see THEME_INIT_SCRIPT). Safe to import from client components.
export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
export const THEME_STORAGE_KEY = "theme";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark";
}

// Runs in <head> before first paint: when the server didn't know the theme,
// take the one saved on this device, else follow the device setting (and
// keep following it live until the user picks one).
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(d.dataset.theme)return;var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark"){d.dataset.theme=s;return;}var m=window.matchMedia("(prefers-color-scheme: dark)");d.dataset.theme=m.matches?"dark":"light";d.dataset.themeAuto="1";m.addEventListener("change",function(e){if(d.dataset.themeAuto)d.dataset.theme=e.matches?"dark":"light";});}catch(e){}})();`;
