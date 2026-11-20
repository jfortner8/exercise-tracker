import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { requireProfile, requireToday } from "@/lib/dal";
import { listAllWorkouts } from "@/lib/db/repo";
import { sportTallies } from "@/lib/sports";

export const metadata: Metadata = { title: "Sports" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function Tallies() {
  const [{ user }, today] = await Promise.all([requireProfile(), requireToday()]);
  // Counted from the workouts themselves, so logging, editing or deleting a session is reflected right away.
  const year = today.slice(0, 4);
  const tallies = sportTallies(await listAllWorkouts(user.sub), year);

  if (!tallies.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
        No completed sport sessions yet. Log a workout as Sport, pick the sport, and mark it done.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tallies.map((t) => (
        <Card key={t.key} className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none" aria-hidden>
              {t.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{t.label}</h2>
              <p className="text-xs text-muted">
                {plural(t.total, "session", "sessions")} · {t.thisYear} this year · last{" "}
                {format(parseISO(t.lastDate), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {t.sessions.map((s) => (
              <div key={s.label} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-xs text-muted">{s.plural.charAt(0).toUpperCase() + s.plural.slice(1)}</dt>
                <dd className="text-xl font-semibold tabular-nums">{s.count}</dd>
              </div>
            ))}
            {t.unspecified > 0 && (
              <div className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-xs text-muted">Unspecified</dt>
                <dd className="text-xl font-semibold tabular-nums">{t.unspecified}</dd>
              </div>
            )}
          </dl>
        </Card>
      ))}
    </div>
  );
}

export default function SportsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Sports" subtitle="Completed games, matches, bouts and practices for every sport you've played." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-2" />}>
        <Tallies />
      </Suspense>
    </div>
  );
}
