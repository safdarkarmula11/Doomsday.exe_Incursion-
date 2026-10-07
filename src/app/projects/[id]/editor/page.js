import Link from "next/link";
import Stepper from "@/components/wizard/Stepper";

// PLACEHOLDER so "Choose this design" has somewhere to go. Task 9 (editor) replaces this file.
export default async function EditorPage({ params }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Stepper current={3} />
        <h1 className="text-2xl font-bold">Editor</h1>
        <p className="mt-2 text-slate-600">Your design is chosen. The editor is built in the next task.</p>
        <Link href={`/projects/${id}/drafts`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to the designs
        </Link>
      </div>
    </main>
  );
}