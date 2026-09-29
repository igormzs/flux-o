import { useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import { motion } from "framer-motion";

/**
 * The saved theme is applied by an inline script in index.html before the app
 * loads, so this only reads the current class and writes on toggle. (v1 wrote
 * "dark" on mount before reading the saved value, which reset light mode on
 * every reload.)
 */
/**
 * Switch the theme in one step. Every element otherwise fades its own colors
 * (the global transition in index.css) at slightly different speeds, and on
 * iOS Safari text over the blurred cards briefly showed boxes of the old
 * theme. Where supported, the whole page cross-fades instead.
 */
function applyTheme(dark: boolean) {
  const root = document.documentElement;
  const swap = () => {
    root.classList.add("theme-switching");
    root.classList.toggle("light", !dark);
    void root.offsetHeight; // apply the new colors with transitions off
    root.classList.remove("theme-switching");
  };
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduceMotion) document.startViewTransition(swap);
  else swap();
}

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains("light"));

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable: the theme still applies for this session.
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {isDark ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
    </motion.button>
  );
};

export default ThemeToggle;
