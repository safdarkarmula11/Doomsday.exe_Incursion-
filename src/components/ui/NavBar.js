"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, Plus } from "lucide-react";

const LINKS = [
  { href: "/", label: "Projects", match: (p) => p === "/" },
  { href: "/brand-kits", label: "Brand kits", match: (p) => p.startsWith("/brand-kits") },
  { href: "/templates", label: "Templates", match: (p) => p.startsWith("/templates") },
];

/** Site-wide top bar (56px, crisp bottom edge). */
export default function NavBar() {
  const pathname = usePathname() || "/";
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <IdCard size={18} aria-hidden="true" />
          </span>
          <span className="hidden whitespace-nowrap font-display text-[15px] font-semibold tracking-tight md:inline">
            Content &amp; Marketing Studio
          </span>
        </Link>
        <span className="mono hidden rounded-full bg-secondary-container px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-on-secondary-container lg:inline">
          ACM NIT Surat × SVNIT
        </span>
        <div className="flex items-center gap-0.5 text-[13px] sm:ml-1 sm:gap-1 sm:text-sm">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors sm:px-3 ${
                  active
                    ? "bg-indigo-600 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <Link href="/projects/new" className="btn-primary ml-auto">
          <Plus size={16} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">New project</span>
        </Link>
      </nav>
    </header>
  );
}