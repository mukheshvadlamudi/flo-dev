import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-fg" />
      <path d="M8 20.5c3.2 0 4.4-9 8-9s4.8 9 8 9" fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-bg" />
      <circle cx="24" cy="11.5" r="2.4" className="fill-accent" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Flo home">
      <LogoMark />
      <span className="text-[17px]">flo</span>
    </Link>
  );
}
