"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="text-sm tracking-wide hover:opacity-80 transition-opacity"
      aria-label="Toggle theme"
    >
      <span className={theme === "light" ? "opacity-100" : "opacity-40"}>
        &lt;LIGHT&gt;
      </span>
      <span className="mx-1 opacity-40">|</span>
      <span className={theme === "dark" ? "opacity-100" : "opacity-40"}>
        &lt;DARK&gt;
      </span>
    </button>
  );
}
