import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode };

const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background,box-shadow,color] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const variants = {
  primary: "bg-fg text-bg hover:shadow-[0_0_0_4px_var(--glow)]",
  secondary: "border border-line-strong bg-raised text-fg shadow-card hover:bg-sunken",
  ghost: "text-muted hover:text-fg hover:bg-sunken",
};
const sizes = { sm: "h-8 px-3.5 text-[13px]", md: "h-10 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, children, href, ...rest }: ButtonProps & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-[0.18em] text-faint", className)}>{children}</p>;
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-line bg-raised shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs text-muted", className)}>{children}</span>;
}

export function SectionHeading({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-gradient mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[40px] sm:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-[15px] leading-relaxed text-pretty text-muted sm:text-base">{sub}</p>}
    </div>
  );
}
