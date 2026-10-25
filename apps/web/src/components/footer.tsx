import Link from "next/link";
import { SITE } from "@/lib/site";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="no-print border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{SITE.tagline}. We reply to every message {SITE.responseTime}.</p>
        </div>
        <FooterCol title="Product" links={[["/#checks", "What we check"], ["/#how", "How it works"], ["/#pricing", "Pricing"], ["/#audit", "Run a free audit"]]} />
        <FooterCol title="Resources" links={[["/#faq", "FAQ"], ["/sample", "Sample report"], ["/expert-audit", "Book an expert audit"]]} />
        <FooterCol title="Legal" links={[["/privacy", "Privacy policy"], ["/terms", "Terms of service"]]} />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-line px-4 py-6 text-xs text-faint sm:flex-row sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Flo. Built for people who ship with AI.</span>
        <a href={`mailto:${SITE.email}`} className="hover:text-fg">
          {SITE.email}
        </a>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-medium text-fg">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted transition hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
