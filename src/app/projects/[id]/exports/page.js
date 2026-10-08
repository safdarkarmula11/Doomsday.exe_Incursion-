import Link from "next/link";
import Stepper from "@/components/wizard/Stepper";

// PLACEHOLDER so "Continue to export" has somewhere to go. Task 11 (export) replaces this file.
export default async function ExportPage({ params }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Stepper current={4} />
        <h1 className="text-2xl font-bold">Export</h1>
        <p className="mt-2 text-slate-600">Your edits are saved. Downloading PDF, PNG and SVG is built in a later task.</p>
        <Link href={`/projects/${id}/editor`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to the editor
        </Link>
      </div>
    </main>
  );
}