import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SITE } from "@/lib/site";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.label, ...(it.href ? { item: `${SITE.url}${it.href}` } : {}) })),
  };
  return (
    <nav aria-label="Breadcrumb" className="no-print mx-auto max-w-6xl px-4 pt-6 pb-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-faint">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" />}
            {it.href ? (
              <Link href={it.href} className="hover:text-fg">
                {it.label}
              </Link>
            ) : (
              <span className="max-w-[40ch] truncate text-muted" aria-current="page">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
