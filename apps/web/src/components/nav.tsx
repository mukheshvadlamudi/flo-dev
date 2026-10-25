import { Logo } from "./logo";
import { ThemeToggle } from "./theme";
import { ButtonLink } from "./ui";

const links = [
  { href: "/#checks", label: "What we check" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-[13px] text-muted transition hover:text-fg">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="/#audit" size="sm">
            Run free audit
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
