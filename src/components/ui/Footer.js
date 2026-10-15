/** Slim site footer. Only states facts the app really does. */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p>
          <span className="font-semibold text-slate-700">ACM NIT Surat × SVNIT</span>
          <span className="mx-2">•</span>
          Content &amp; Marketing Studio
        </p>
        <p className="mono text-[11px] text-slate-500">CR80 54 × 85.6 mm • print-ready PDF / PNG / SVG</p>
      </div>
    </footer>
  );
}