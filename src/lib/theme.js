// Light/dark theme. Defaults to the OS preference; an explicit choice
// is remembered and wins from then on.

const KEY = "marathi-shika-theme";

export function getStoredTheme() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

// The theme actually in effect right now.
export function effectiveTheme() {
  return getStoredTheme() || (systemPrefersDark() ? "dark" : "light");
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // Keep the browser chrome (mobile address bar) in sync with the header.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#2a0e1d" : "#8e2a5c");
}

export function setTheme(theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* preference just won't persist */
  }
  applyTheme(theme);
}
