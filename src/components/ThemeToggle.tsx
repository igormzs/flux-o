import { useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import { motion } from "framer-motion";

/**
 * The saved theme is applied by an inline script in index.html before the app
 * loads, so this only reads the current class and writes on toggle. (v1 wrote
 * "dark" on mount before reading the saved value, which reset light mode on
 * every reload.)
 */
const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains("light"));

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("light", !next);
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
