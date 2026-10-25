"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "flo-theme";

/** Runs before paint so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(!t){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme((document.documentElement.dataset.theme as "light" | "dark") ?? "dark"), []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };
  return (
    <button onClick={flip} aria-label="Toggle colour theme" className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-fg">
      {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
