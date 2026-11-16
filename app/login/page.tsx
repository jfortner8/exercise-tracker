import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  expired: "Your sign-in took too long. Please try again.",
  callback: "Sign-in failed. Please try again.",
  claims: "Your account is missing an email address.",
};

async function ErrorNote({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const msg = typeof error === "string" ? (ERRORS[error] ?? "Sign-in failed.") : null;
  return msg ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{msg}</p> : null;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="space-y-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-fg">
            <Activity className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Stride</h1>
          <p className="text-sm text-muted">
            Plan your training on a calendar, log what you actually did, and track your personal bests.
          </p>
        </div>
        <Suspense>
          <ErrorNote searchParams={searchParams} />
        </Suspense>
        <a
          href="/api/auth/login"
          className="flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-fg hover:brightness-110"
        >
          Sign in
        </a>
        <p className="text-center text-sm text-muted">
          New here?{" "}
          <a href="/api/auth/login?signup=1" className="font-medium text-accent hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
