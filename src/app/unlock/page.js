import Link from "next/link";
import { Lock } from "lucide-react";
import UnlockForm from "./UnlockForm";
import { authEnabled, safeNext } from "@/lib/auth";

export const metadata = { title: "Enter passcode" };
export const dynamic = "force-dynamic";

export default async function UnlockPage({ searchParams }) {
  const { next } = await searchParams;
  const enabled = authEnabled();
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-sm px-4 py-16">
        <div className="card p-6 sm:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">Enter the passcode</h1>
          {enabled ? (
            <>
              <p className="mt-1 text-sm text-slate-600">
                This studio holds people&apos;s names and photos, so it is protected. Ask the organizers for the passcode.
              </p>
              <UnlockForm next={safeNext(next)} />
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No passcode is set, so the app is open.{" "}
              <Link href="/" className="font-medium text-indigo-600 hover:underline">Go to the home page</Link>.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}