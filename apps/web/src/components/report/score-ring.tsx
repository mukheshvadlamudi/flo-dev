"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { scoreColor } from "./format";

export function ScoreRing({ value, size = 168, stroke = 10, label, grade }: { value: number; size?: number; stroke?: number; label?: string; grade?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const offset = useTransform(mv, (v) => c - (v / 100) * c);
  useEffect(() => {
    const ctl = animate(mv, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => ctl.stop();
  }, [mv, value]);
  const color = scoreColor(value);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 10px color-mix(in oklab, ${color} 45%, transparent))` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <motion.span className="block font-mono leading-none font-semibold tracking-tight tabular-nums" style={{ fontSize: size / 4 }}>
            {rounded}
          </motion.span>
          {(label || grade) && <span className="mt-1 block text-xs text-muted">{grade ? `Grade ${grade}` : label}</span>}
        </div>
      </div>
    </div>
  );
}

export function MiniScore({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-3">
      <ScoreRing value={value} size={56} stroke={5} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-faint">{value >= 80 ? "Solid" : value >= 65 ? "Needs work" : value >= 50 ? "Risky" : "Not ready"}</p>
      </div>
    </div>
  );
}
