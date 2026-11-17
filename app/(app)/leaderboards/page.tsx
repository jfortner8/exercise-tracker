import { format, parseISO, subMonths } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { BENCHMARK_CATALOG, CATEGORY_LABEL } from "@/lib/benchmarks/catalog";
import { requireProfile } from "@/lib/dal";
import { getLeaderboards } from "@/lib/db/repo";
import {
  formatResult,
  IMPROVEMENT_WINDOWS,
  improvementPct,
  kgToDisplay,
  weightUnit,
  ymd,
  type ImprovementWindow,
} from "@/lib/domain";
import type { LeaderboardEntry, Units } from "@/lib/types";

export const metadata: Metadata = { title: "Leaderboards" };

type View = "best" | ImprovementWindow;
const VIEWS: { key: View; label: string }[] = [{ key: "best", label: "Best" }, ...IMPROVEMENT_WINDOWS];

type Catalog = (typeof BENCHMARK_CATALOG)[number];

/** A score as text: the result itself, or the estimated 1RM for weight × reps. */
function scoreText(c: Catalog, score: number, units: Units) {
  if (c.metricKind === "weight_reps") return `${Math.round(kgToDisplay(score, units))} ${weightUnit(units)} e1RM`;
  return formatResult(c, { value: score }, units);
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboards">["searchParams"] }) {
  const sp = await searchParams;
  const { user, profile } = await requireProfile();

  // One cached read for every board (invalidated when someone's PB row changes).
  const all = await getLeaderboards();
  const boards = BENCHMARK_CATALOG.map((c) => ({ c, entries: all[c.key] ?? [] }));
  const withEntries = boards.filter((b) => b.entries.length > 0);
  const selected = withEntries.find((b) => b.c.key === sp.b) ?? withEntries[0];
  const view: View = VIEWS.some((v) => v.key === sp.w) ? (sp.w as View) : "best";
  const href = (b: string, w: View) => `/leaderboards?b=${b}&w=${w}`;

  return (
    <div className="space-y-5">
      {!profile.leaderboard && (
        <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
          You&apos;re not on the leaderboards.{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Turn on &ldquo;Show my PBs on leaderboards&rdquo; in Settings
          </Link>{" "}
          to join.
        </div>
      )}

      {!selected ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No one has shared a PB yet. Leaderboards fill in as people opt in and log results on built-in benchmarks.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {(["cardio", "swim", "strength", "mobility"] as const).map((cat) => {
              const inCat = withEntries.filter((b) => b.c.category === cat);
              if (!inCat.length) return null;
              return (
                <div key={cat} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  {inCat.map((b) => (
                    <Link
                      key={b.c.key}
                      href={href(b.c.key, view)}
                      className={
                        b.c.key === selected.c.key
                          ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                          : "rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
                      }
                    >
                      {b.c.name} <span className="opacity-60">{b.entries.length}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>

          <Board
            c={selected.c}
            entries={selected.entries}
            view={view}
            me={user.sub}
            units={profile.units}
            tabs={VIEWS.map((v) => ({ ...v, href: href(selected.c.key, v.key) }))}
          />
        </>
      )}
    </div>
  );
}

function Board({
  c,
  entries,
  view,
  me,
  units,
  tabs,
}: {
  c: Catalog;
  entries: LeaderboardEntry[];
  view: View;
  me: string;
  units: Units;
  tabs: { key: View; label: string; href: string }[];
}) {
  const window = IMPROVEMENT_WINDOWS.find((w) => w.key === view);
  const since = window ? ymd(subMonths(new Date(), window.months)) : "";

  const rows = window
    ? entries
        .map((e) => {
          const pct = improvementPct(e.history, c.direction, since);
          const then = [...e.history].reverse().find((h) => h.date <= since);
          return { e, pct, then };
        })
        .filter((r): r is { e: LeaderboardEntry; pct: number; then: { date: string; score: number } } => r.pct != null)
        .sort((a, b) => b.pct - a.pct)
    : entries.map((e) => ({ e, pct: undefined, then: undefined }));
  const left = entries.length - rows.length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="mr-auto">
          <h2 className="font-semibold">{c.name}</h2>
          <p className="text-xs text-muted">
            {window
              ? `Improvement in the PB over the last ${window.label.replace("mo", "months").replace("yr", "year").replace(/^1 months/, "1 month")}`
              : `${c.direction === "lower" ? "Lowest" : "Highest"} is best${c.metricKind === "weight_reps" ? " · ranked by estimated 1RM" : ""}`}
          </p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={
                t.key === view
                  ? "rounded-md bg-surface-2 px-2.5 py-1 font-medium text-text"
                  : "rounded-md px-2.5 py-1 font-medium text-muted hover:text-text"
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Nobody has a result from before {since} yet, so there&apos;s no improvement to compare.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {rows.map(({ e, pct, then }, i) => (
            <li
              key={e.sub}
              className={e.sub === me ? "flex items-center gap-3 bg-accent/5 px-4 py-2.5" : "flex items-center gap-3 px-4 py-2.5"}
            >
              <span className="w-6 text-right text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {e.displayName}
                {e.sub === me && <span className="ml-1.5 text-xs font-normal text-accent">You</span>}
              </span>
              {pct != null && then ? (
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums">
                    {pct > 0 ? "+" : ""}
                    {pct.toFixed(1)}%
                  </span>
                  <span className="block text-xs tabular-nums text-muted">
                    {scoreText(c, then.score, units)} → {scoreText(c, e.score, units)}
                  </span>
                </span>
              ) : (
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums">{formatResult(c, e, units)}</span>
                  <span className="block text-xs text-muted">
                    {c.metricKind === "weight_reps" ? `${scoreText(c, e.score, units)} · ` : ""}
                    {format(parseISO(e.date), "MMM d, yyyy")}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {window && left > 0 && rows.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          {left} more {left === 1 ? "person has" : "people have"} no result from before {since} to compare against.
        </p>
      )}
    </section>
  );
}

export default function LeaderboardsPage({ searchParams }: PageProps<"/leaderboards">) {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Leaderboards"
        subtitle="PBs on built-in benchmarks from everyone who has opted in."
      />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
