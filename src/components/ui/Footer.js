import Link from "next/link";
import { IdCard } from "lucide-react";

const COLUMNS = [
  {
    title: "Studio",
    links: [
      { href: "/projects/new", label: "New project" },
      { href: "/", label: "Your projects" },
      { href: "/brand-kits", label: "Brand kits" },
      { href: "/templates", label: "Templates" },
    ],
  },
  {
    title: "Guide",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#csv", label: "People CSV format" },
      { href: "/#faq", label: "FAQ" },
      { href: "/sample-people-photos.csv", label: "Sample CSV", download: true },
    ],
  },
];

const FLOW = ["Describe", "Questions", "Drafts", "Editor", "People", "Export"];

/** Site footer. Only states facts the app really does. Server component. */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <IdCard size={18} aria-hidden="true" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight">Content &amp; Marketing Studio</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
            Print-ready event ID cards with role colours, photos and QR codes. Built for ACM NIT Surat × SVNIT.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <img src="/logos/ACMLogo.png" alt="ACM NIT Surat" className="h-8 w-auto object-contain" />
            <img src="/logos/NIT_Surat_Logo.svg.webp" alt="SVNIT Surat" className="h-8 w-auto object-contain" />
          </div>
        </div>

        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.download ? (
                    <a href={l.href} download className="text-slate-700 hover:text-indigo-700 hover:underline">{l.label}</a>
                  ) : (
                    <Link href={l.href} className="text-slate-700 hover:text-indigo-700 hover:underline">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">The flow</h2>
          <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5 text-sm text-slate-700">
            {FLOW.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span>{s}</span>
                {i < FLOW.length - 1 && <span className="text-slate-300" aria-hidden="true">→</span>}
              </li>
            ))}
          </ol>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-slate-500">
            CR80 54 × 85.6 mm • 3 mm bleed • 300 dpi
            <br />
            PDF / PNG / SVG • A4 and A3 sheets
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ACM NIT Surat × SVNIT. Incursion hackathon, Track 4.</p>
          <p>Made with Next.js, Prisma and PostgreSQL.</p>
        </div>
      </div>
    </footer>
  );
}