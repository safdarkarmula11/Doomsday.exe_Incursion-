import Link from "next/link";
import {
  ArrowRight, FileText, ListChecks, LayoutTemplate, PenTool, Users, Printer, Palette, QrCode, ShieldCheck,
  Wand2, FileSpreadsheet, Image as ImageIcon, ScanLine,
} from "lucide-react";
import SampleCard from "@/components/home/SampleCard";
import ProjectsList from "@/components/home/ProjectsList";

const STEPS = [
  {
    title: "Describe your event",
    Icon: FileText,
    does: "Type a few lines about the event in plain English.",
    gets: "The app reads out the name, date, venue and roles. Anything it is unsure about is marked for you to check.",
  },
  {
    title: "Answer the questions",
    Icon: ListChecks,
    does: "Fill in only what is missing, choose what goes on the card, and add your attendance link.",
    gets: "Nothing is invented. Every detail on the card is one you confirmed.",
  },
  {
    title: "Pick a design",
    Icon: LayoutTemplate,
    does: "Compare 3 different drafts, each shown in every role colour.",
    gets: "Both the ACM NIT Surat and SVNIT logos on every card, never stretched.",
  },
  {
    title: "Fine-tune it",
    Icon: PenTool,
    does: "Click anything on the card to move it or change its colour, or type a change such as “make the name bigger”.",
    gets: "A live preview that updates as you edit.",
  },
  {
    title: "Add your people",
    Icon: Users,
    does: "Upload a CSV with names, roles, IDs and optional photo links.",
    gets: "A preview of real cards. People without a photo show their initials.",
  },
  {
    title: "Export and print",
    Icon: Printer,
    does: "Run the pre-flight check, then download.",
    gets: "Print-ready PDF with bleed and crop marks, 300 dpi PNG, SVG, and A4 or A3 sheets with a QR code per person.",
  },
];

const FEATURES = [
  { Icon: Palette, title: "Role colour-coding", text: "Participants, mentors, organizers and volunteers each get their own colour, so staff can tell them apart at a glance." },
  { Icon: LayoutTemplate, title: "Distinct drafts", text: "Three genuinely different layouts to choose from, plus more you can add or upload as JSON." },
  { Icon: Wand2, title: "Plain-English edits", text: "Describe a change in words and the card updates. The manual controls are always there as well." },
  { Icon: FileSpreadsheet, title: "CSV import", text: "Common column names are matched automatically. Unknown roles can be mapped or skipped." },
  { Icon: ImageIcon, title: "Real photos", text: "Photos come from your data and fill a frame without being squashed." },
  { Icon: QrCode, title: "QR per person", text: "Each card carries a QR code made from your attendance link plus the person's ID." },
  { Icon: ShieldCheck, title: "Pre-flight check", text: "Warns about tiny text, content too close to the edge, long names and QR codes that may not scan." },
  { Icon: Printer, title: "Print-ready", text: "CR80 size (54 × 85.6 mm), 3 mm bleed, crop marks, and sheets sized for A4 or A3." },
];

const ROLES = [
  { role: "participant", label: "Participant", photo: "/sample-photos/p01.png" },
  { role: "mentor", label: "Mentor", photo: "/sample-photos/p05.png" },
  { role: "organizer", label: "Organizer", photo: "/sample-photos/p07.png" },
  { role: "volunteer", label: "Volunteer", photo: "/sample-photos/p10.png" },
];

const FAQ = [
  ["Do I need an account?", "No. Open the site, create a project and start."],
  ["What do I need before I start?", "A short description of the event, your logos if they differ from the defaults, and a CSV of people. Photos are optional."],
  ["Does it generate images with AI?", "No. Cards are drawn from templates, so text and logos stay sharp. An AI helper only reads your event description and your plain-English edits, and the app works with simpler rules if it is unavailable."],
  ["What if someone has no photo?", "Their card shows their initials in their role colour, so nothing looks broken."],
  ["What does the QR code contain?", "Your attendance link followed by the person's ID. Use your own check-in page, or the event site address."],
  ["How do I print the cards?", "Export the PDF with bleed and crop marks for a print shop, or the A4 or A3 sheets to cut yourself. Run the pre-flight check first."],
  ["What if a name is very long?", "The text shrinks to fit, and the pre-flight check tells you if it had to be cut off."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-100/70 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative">
            <p className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
              ACM NIT Surat × SVNIT
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Event ID cards, designed in minutes and ready to print
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Describe your event, pick a design, add your people from a CSV, and export print-ready cards with role colours,
              photos and QR codes.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/projects/new" className="btn-primary px-5 py-3 text-base">
                Start a new project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="btn-secondary px-5 py-3 text-base">
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {["Both logos, undistorted", "Print-ready PDF, PNG, SVG", "No account needed"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="flex items-center justify-center">
              <SampleCard template="midnight" role="mentor" photo="/sample-photos/p06.png" prefix="h1" className="-mr-10 mt-8 hidden w-40 -rotate-6 sm:block md:w-44" />
              <SampleCard template="campus" role="participant" photo="/sample-photos/p01.png" prefix="h2" className="relative z-10 w-52 md:w-56" />
              <SampleCard template="aurora" role="organizer" photo="/sample-photos/p07.png" prefix="h3" className="-ml-10 mt-8 hidden w-40 rotate-6 sm:block md:w-44" />
            </div>
            <p className="mt-5 text-center font-mono text-[11px] text-slate-500">Sample cards with placeholder text and drawn avatars</p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-12 sm:space-y-20 sm:py-16">
        {/* ---------- Projects ---------- */}
        <ProjectsList />

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="scroll-mt-20" aria-labelledby="how-heading">
          <p className="eyebrow">Workflow</p>
          <h2 id="how-heading" className="font-display text-3xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">Six steps from a few lines of text to a stack of printed cards. You can go back to any step at any time.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-mono text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <s.Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{s.does}</p>
                <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-500">
                  <span className="font-semibold text-slate-700">You get: </span>
                  {s.gets}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link href="/projects/new" className="btn-primary px-5 py-2.5">
              Start step 1
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ---------- Roles ---------- */}
        <section aria-labelledby="roles-heading">
          <p className="eyebrow">Role colours</p>
          <h2 id="roles-heading" className="font-display text-3xl font-bold tracking-tight text-slate-900">
            One design, a colour for every role
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">The same layout is repeated for each role, so you can spot who is who from across the room.</p>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {ROLES.map((r) => (
              <figure key={r.role} className="text-center">
                <SampleCard template="campus" role={r.role} photo={r.photo} prefix={`r${r.role}`} className="mx-auto w-full max-w-[200px]" />
                <figcaption className="mt-3 text-sm font-medium text-slate-700">{r.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section aria-labelledby="features-heading">
          <p className="eyebrow">What you get</p>
          <h2 id="features-heading" className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Built for print, not just for the screen
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <f.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- CSV ---------- */}
        <section id="csv" className="scroll-mt-20" aria-labelledby="csv-heading">
          <div className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Before you start</p>
              <h2 id="csv-heading" className="font-display text-3xl font-bold tracking-tight text-slate-900">
                Get your people list ready
              </h2>
              <p className="mt-3 text-slate-600">One row per person. Column names are matched for you, so common variants work.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li><span className="font-semibold">Name</span> and <span className="font-semibold">Role</span> are required.</li>
                <li><span className="font-semibold">ID Number</span> is used for the card and the QR code.</li>
                <li><span className="font-semibold">Photo Link</span> is optional and must start with <span className="font-mono">https://</span>.</li>
                <li>Extra columns, such as Department, are kept.</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="/sample-people-photos.csv" download className="btn-secondary btn-sm">
                  <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
                  Download sample CSV
                </a>
                <a href="/sample-people.csv" download className="btn-ghost btn-sm">
                  Sample without photos
                </a>
              </div>
            </div>
            <pre className="self-start overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100" aria-label="Example CSV">
{`Name,Role,ID Number,Photo Link,Department
Aarav Sharma,participant,PART-001,https://…/aarav.jpg,CSE
Kabir Singh,mentor,MENT-001,https://…/kabir.jpg,CSE
Priya Nair,organizer,ORG-001,,ECE
Neel Joshi,volunteer,VOL-001,,EE`}
            </pre>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="scroll-mt-20" aria-labelledby="faq-heading">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-heading" className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Frequently asked
          </h2>
          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="text-xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="rounded-2xl bg-indigo-600 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="font-display text-3xl font-bold tracking-tight">Ready to make your cards?</h2>
          <p className="mx-auto mt-2 max-w-xl text-indigo-100">It takes a few minutes. You can change anything before you print.</p>
          <Link href="/projects/new" className="btn mt-6 bg-white px-5 py-3 text-base text-indigo-700 hover:bg-indigo-50">
            Start a new project
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}