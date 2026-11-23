import { format, parseISO, subMonths } from "date-fns";
import type { Metadata } from "next";
import { Globe, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cx, PageHeader } from "@/components/ui";
import { BENCHMARK_CATALOG, CATEGORY_LABEL } from "@et/core/benchmarks/catalog";
import { requireProfile, requireToday } from "@/lib/dal";
import { ApiError } from "@/lib/api-error";
import { leaderboardData } from "@/lib/services/leaderboards";
import {
  formatResult,
  IMPROVEMENT_WINDOWS,
  improvementPct,
  kgToDisplay,
  weightUnit,
  ymd,
  type ImprovementWindow,
} from "@et/core/domain";
import { CONSISTENCY_DAYS, CONSISTENCY_MIN_DAYS, rankConsistency, seasonBoard } from "@et/core/leaderboard-views";
import type { ConsistencyRow, LeaderboardEntry, Units } from "@et/core/types";

export const metadata: Metadata = { title: "Leaderboards" };

/** Best ever, best this season (calendar year), or improvement over a window. */
type View = "best" | "season" | ImprovementWindow;
const views = (year: string): { key: View; label: string }[] => [
  { key: "best", label: "Best" },
  { key: "season", label: year },
  ...IMPROVEMENT_WINDOWS,
];
/** The board key for the Consistency board (benchmark boards use catalog keys). */
const CONSISTENCY = "consistency";

type Catalog = (typeof BENCHMARK_CATALOG)[number];

/** A score as text: the result itself, or the estimated 1RM for weight × reps. */
function scoreText(c: Catalog, score: number, units: Units) {
  if (c.metricKind === "weight_reps") return `${Math.round(kgToDisplay(score, units))} ${weightUnit(units)} e1RM`;
  return formatResult(c, { value: score }, units);
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboards">["searchParams"] }) {
  const sp = await searchParams;
  const { user, profile } = await requireProfile();

  // Membership is checked in the service, on the server, before any board is read.
  const groupKey = typeof sp.g === "string" ? sp.g : "friends";
  const data = await leaderboardData(user.sub, groupKey).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound(); // not your club, or no such club
    throw e;
  });
  const { groups, boards: all, consistency, hasConsistency, friendCount } = data;
  const today = await requireToday();
  const year = today.slice(0, 4);
  const VIEWS = views(year);

  const boards = BENCHMARK_CATALOG.map((c) => ({ c, entries: all[c.key] ?? [] }));
  const withEntries = boards.filter((b) => b.entries.length > 0);
  const showConsistency = hasConsistency && (sp.b === CONSISTENCY || (!withEntries.length && !!consistency.length));
  const selected = withEntries.find((b) => b.c.key === sp.b) ?? withEntries[0];
  const view: View = VIEWS.some((v) => v.key === sp.w) ? (sp.w as View) : "best";
  const href = (g: string, b: string | undefined, w: View) =>
    `/leaderboards?g=${encodeURIComponent(g)}${b ? `&b=${b}` : ""}&w=${w}`;

  return (
    <div className="space-y-5">
      <nav aria-label="Boards" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {groups.map((g) => (
          <Link
            key={g.key}
            href={href(g.key, showConsistency ? CONSISTENCY : selected?.c.key, view)}
            aria-current={g.key === groupKey ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium",
              g.key === groupKey ? "border-accent bg-accent/10 text-accent-ink" : "border-border bg-surface text-muted hover:text-text",
            )}
          >
            {g.key === "friends" && <Users className="mr-1.5 inline size-3.5 -translate-y-px" />}
            {g.key === "everyone" && <Globe className="mr-1.5 inline size-3.5 -translate-y-px" />}
            {g.label}
          </Link>
        ))}
      </nav>

      {profile.share === "off" ? (
        <Notice>
          You&apos;re hidden from every leaderboard.{" "}
          <Link href="/settings" className="font-medium text-accent-ink hover:underline">
            Choose who sees your PBs in Settings
          </Link>
          .
        </Notice>
      ) : (
        groupKey === "everyone" &&
        profile.share === "circle" && (
          <Notice>
            You share with friends &amp; clubs only, so you&apos;re not on this board.{" "}
            <Link href="/settings" className="font-medium text-accent-ink hover:underline">
              Change it in Settings
            </Link>
            .
          </Notice>
        )
      )}

      {groupKey === "friends" && friendCount === 0 ? (
        <Empty>
          Add friends with their friend code to compare PBs.{" "}
          <Link href="/friends" className="font-medium text-accent-ink hover:underline">
            Get your code or add a friend
          </Link>
        </Empty>
      ) : !selected && !showConsistency ? (
        <Empty>
          {groupKey === "everyone"
            ? "Nobody shares with everyone yet."
            : `No PBs on built-in benchmarks here yet. They show up as ${groupKey === "friends" ? "you and your friends" : "members"} log results.`}
        </Empty>
      ) : (
        <>
          <div className="space-y-2">
            {hasConsistency && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">Habits</span>
                <Link
                  href={href(groupKey, CONSISTENCY, view)}
                  className={
                    showConsistency
                      ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-ink"
                      : "rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
                  }
                >
                  Consistency <span className="opacity-60">{consistency.length}</span>
                </Link>
              </div>
            )}
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
                      href={href(groupKey, b.c.key, view)}
                      className={
                        !showConsistency && b.c.key === selected?.c.key
                          ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-ink"
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

          {showConsistency || !selected ? (
            <ConsistencyBoard
              rows={consistency}
              today={today}
              me={user.sub}
              optedIn={profile.share !== "off" && profile.shareConsistency === true}
            />
          ) : (
            <Board
              c={selected.c}
              entries={selected.entries}
              view={view}
              today={today}
              me={user.sub}
              units={profile.units}
              tabs={VIEWS.map((v) => ({ ...v, href: href(groupKey, selected.c.key, v.key) }))}
            />
          )}
        </>
      )}
    </div>
  );
}

const Notice = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">{children}</div>
);
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</p>
);

function Board({
  c,
  entries,
  view,
  today,
  me,
  units,
  tabs,
}: {
  c: Catalog;
  entries: LeaderboardEntry[];
  view: View;
  /** Today where the viewer is (YYYY-MM-DD). */
  today: string;
  me: string;
  units: Units;
  tabs: { key: View; label: string; href: string }[];
}) {
  const window = IMPROVEMENT_WINDOWS.find((w) => w.key === view);
  const year = today.slice(0, 4);
  const since = window ? ymd(subMonths(parseISO(today), window.months)) : "";
  const season = view === "season";

  // This season: each person's best this year, so an easy day never lowers it and January starts fresh.
  const rows = season
    ? seasonBoard(entries, year, c.direction).map(({ e, best }) => ({
        e: { ...e, value: best.value, reps: best.reps, date: best.date, score: best.score },
        pct: undefined,
        then: undefined,
      }))
    : window
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
            {season
              ? `Best result in ${year} · resets every January`
              : window
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
          {season
            ? `No results yet in ${year}. Fresh season!`
            : `Nobody has a result from before ${since} yet, so there's no improvement to compare.`}
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
                {e.sub === me && <span className="ml-1.5 text-xs font-normal text-accent-ink">You</span>}
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
      {season && left > 0 && rows.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          {left} more {left === 1 ? "person has" : "people have"} no result yet in {year}.
        </p>
      )}
      {window && left > 0 && rows.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          {left} more {left === 1 ? "person has" : "people have"} no result from before {since} to compare against.
        </p>
      )}
    </section>
  );
}

/** Friends' or a club's consistency: % of days on track over the last 4 weeks. */
function ConsistencyBoard({ rows, today, me, optedIn }: { rows: ConsistencyRow[]; today: string; me: string; optedIn: boolean }) {
  const { ranked, tooNew } = rankConsistency(rows, today);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold">Consistency</h2>
        <p className="text-xs text-muted">
          Days on track over the last {CONSISTENCY_DAYS / 7} weeks: planned workouts done and planned rest days. Injured days
          don&apos;t count against you.
        </p>
      </div>
      {!optedIn && (
        <p className="border-b border-border bg-surface-2/60 px-4 py-2.5 text-sm">
          You&apos;re not on this board.{" "}
          <Link href="/settings" className="font-medium text-accent-ink hover:underline">
            Turn on &ldquo;Also show my consistency&rdquo; in Settings
          </Link>
          .
        </p>
      )}
      {ranked.length === 0 && tooNew.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Nobody here shares their consistency yet. It&apos;s opt-in, in Settings.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {ranked.map(({ r, c }, i) => (
            <li
              key={r.sub}
              className={r.sub === me ? "flex items-center gap-3 bg-accent/5 px-4 py-2.5" : "flex items-center gap-3 px-4 py-2.5"}
            >
              <span className="w-6 text-right text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.displayName}
                {r.sub === me && <span className="ml-1.5 text-xs font-normal text-accent-ink">You</span>}
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">{c.pct}%</span>
                <span className="block text-xs tabular-nums text-muted">
                  {c.on} of {c.of} days · {c.workouts} {c.workouts === 1 ? "workout" : "workouts"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {tooNew.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          Not ranked yet (under {CONSISTENCY_MIN_DAYS} days to count): {tooNew.map((x) => x.r.displayName).join(", ")}.
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
        subtitle="PBs on built-in benchmarks, and consistency: with your friends, in your clubs, or with everyone."
        actions={
          <Link
            href="/friends"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium hover:bg-surface-2"
          >
            <Users className="size-4" /> Friends &amp; clubs
          </Link>
        }
      />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
