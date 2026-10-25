"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card with a soft light that follows the cursor and lights up the border underneath it. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--x", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-line bg-raised shadow-card",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        "before:bg-[radial-gradient(420px_circle_at_var(--x)_var(--y),var(--accent-soft),transparent_45%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
