import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import type { LeaderboardsResponse } from "@et/core/api-types";
import { BENCHMARK_CATALOG, CATEGORY_LABEL } from "@et/core/benchmarks/catalog";
import { formatResult, IMPROVEMENT_WINDOWS, improvementPct, kgToDisplay, weightUnit, ymd, type ImprovementWindow } from "@et/core/domain";
import { CONSISTENCY_DAYS, CONSISTENCY_MIN_DAYS, rankConsistency, seasonBoard } from "@et/core/leaderboard-views";
import type { ConsistencyRow, LeaderboardEntry, Units } from "@et/core/types";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { Body, Button, ErrorText, Screen, Title } from "@/ui";
import { Chips } from "@/ui/form";
import { ChipScroller, Empty, List, ListRow, Notice } from "@/ui/list";

/** The same boards as the website's Leaderboards page: PBs on built-in benchmarks, and Consistency. */
type View = "best" | "season" | ImprovementWindow;
type Catalog = (typeof BENCHMARK_CATALOG)[number];
const CONSISTENCY = "consistency";
const DEFAULT_UNITS: Units = { distance: "mi", weight: "lb" };

const scoreText = (c: Catalog, score: number, units: Units) =>
  c.metricKind === "weight_reps" ? `${Math.round(kgToDisplay(score, units))} ${weightUnit(units)} e1RM` : formatResult(c, { value: score }, units);

export default function Ranks() {
  const me = useMe();
  // A club page opens its board with ?g=<clubId>.
  const { g } = useLocalSearchParams<{ g?: string }>();
  const [group, setGroup] = useState(g ?? "friends");
  const [seenG, setSeenG] = useState(g);
  if (g !== seenG) {
    setSeenG(g);
    if (g) setGroup(g);
  }
  const [board, setBoard] = useState<string>();
  const [view, setView] = useState<View>("best");
  const q = useQuery({
    queryKey: ["leaderboards", group],
    queryFn: () => api<LeaderboardsResponse>(`/leaderboards?g=${encodeURIComponent(group)}`),
    // Keep the last board up while the next group loads, so the group chips stay put.
    placeholderData: (prev) => prev,
  });
  const profile = me.data?.profile;
  const today = me.data?.today ?? ymd(new Date());
  const year = today.slice(0, 4);
  const data = q.data;

  const withEntries = data ? BENCHMARK_CATALOG.map((c) => ({ c, entries: data.boards[c.key] ?? [] })).filter((b) => b.entries.length) : [];
  const showConsistency = !!data?.hasConsistency && (board === CONSISTENCY || (!withEntries.length && !!data.consistency.length));
  const selected = withEntries.find((b) => b.c.key === board) ?? withEntries[0];
  const settings = <Button title="Open Settings" variant="link" onPress={() => router.navigate("/settings")} />;

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="PBs on built-in benchmarks, and consistency: with friends, in your clubs, or with everyone.">Ranks</Title>
      <ChipScroller
        options={(data?.groups ?? [{ key: "friends", label: "Friends" }]).map((g) => ({ value: g.key, label: g.label }))}
        value={group}
        onChange={setGroup}
      />
      {profile?.share === "off" ? (
        <Notice>
          <Body>You&apos;re hidden from every leaderboard. Choose who sees your PBs in Settings.</Body>
          {settings}
        </Notice>
      ) : group === "everyone" && profile?.share === "circle" ? (
        <Notice>
          <Body>You share with friends and clubs only, so you&apos;re not on this board.</Body>
          {settings}
        </Notice>
      ) : null}
      <ErrorText>{q.error?.message}</ErrorText>
      {!data ? (
        q.isPending ? <Body muted>Loading…</Body> : null
      ) : group === "friends" && data.friendCount === 0 ? (
        <Empty>
          <Body muted style={{ textAlign: "center" }}>Add friends with their friend code to compare PBs.</Body>
          <Button title="Get your code or add a friend" variant="link" onPress={() => router.navigate("/friends")} />
        </Empty>
      ) : !selected && !showConsistency ? (
        <Empty>
          {group === "everyone"
            ? "Nobody shares with everyone yet."
            : `No PBs on built-in benchmarks here yet. They show up as ${group === "friends" ? "you and your friends" : "members"} log results.`}
        </Empty>
      ) : (
        <>
          {data.hasConsistency && (
            <ChipScroller
              label="Habits"
              options={[{ value: CONSISTENCY, label: "Consistency", count: data.consistency.length }]}
              value={showConsistency ? CONSISTENCY : undefined}
              onChange={setBoard}
            />
          )}
          {(["cardio", "swim", "strength", "mobility"] as const).map((cat) => {
            const inCat = withEntries.filter((b) => b.c.category === cat);
            return inCat.length ? (
              <ChipScroller
                key={cat}
                label={CATEGORY_LABEL[cat]}
                options={inCat.map((b) => ({ value: b.c.key, label: b.c.name, count: b.entries.length }))}
                value={showConsistency ? undefined : selected?.c.key}
                onChange={setBoard}
              />
            ) : null;
          })}
          {showConsistency || !selected ? (
            <ConsistencyBoard
              rows={data.consistency}
              today={today}
              me={me.data?.user.sub}
              optedIn={profile?.share !== "off" && profile?.shareConsistency === true}
            />
          ) : (
            <>
              <Chips
                options={[{ value: "best" as View, label: "Best" }, { value: "season" as View, label: year }, ...IMPROVEMENT_WINDOWS.map((w) => ({ value: w.key as View, label: w.label }))]}
                value={view}
                onChange={(v) => v && setView(v)}
              />
              <Board c={selected.c} entries={selected.entries} view={view} today={today} me={me.data?.user.sub} units={profile?.units ?? DEFAULT_UNITS} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Board({ c, entries, view, today, me, units }: { c: Catalog; entries: LeaderboardEntry[]; view: View; today: string; me?: string; units: Units }) {
  const window = IMPROVEMENT_WINDOWS.find((w) => w.key === view);
  const year = today.slice(0, 4);
  const since = window ? ymd(subMonths(parseISO(today), window.months)) : "";
  const season = view === "season";
  const rows = season
    ? seasonBoard(entries, year, c.direction).map(({ e, best }) => ({ e: { ...e, value: best.value, reps: best.reps, date: best.date, score: best.score }, pct: undefined, then: undefined }))
    : window
      ? entries
          .map((e) => ({ e, pct: improvementPct(e.history, c.direction, since), then: [...e.history].reverse().find((h) => h.date <= since) }))
          .filter((r): r is { e: LeaderboardEntry; pct: number; then: { date: string; score: number } } => r.pct != null && !!r.then)
          .sort((a, b) => b.pct - a.pct)
      : entries.map((e) => ({ e, pct: undefined, then: undefined }));
  const left = entries.length - rows.length;
  const subtitle = season
    ? `Best result in ${year} · resets every January`
    : window
      ? `Improvement in the PB over the last ${window.label.replace("mo", " months").replace("yr", " year").replace(/^1 months/, "1 month")}`
      : `${c.direction === "lower" ? "Lowest" : "Highest"} is best${c.metricKind === "weight_reps" ? " · ranked by estimated 1RM" : ""}`;
  const footer =
    left > 0 && rows.length > 0 && (season || window)
      ? `${left} more ${left === 1 ? "person has" : "people have"} ${season ? `no result yet in ${year}` : `no result from before ${since} to compare against`}.`
      : undefined;
  return (
    <List title={c.name} subtitle={subtitle} footer={footer}>
      {rows.length === 0 ? (
        <Body muted style={{ textAlign: "center", padding: 24 }}>
          {season ? `No results yet in ${year}. Fresh season!` : `Nobody has a result from before ${since} yet, so there's no improvement to compare.`}
        </Body>
      ) : (
        rows.map(({ e, pct, then }, i) => (
          <ListRow
            key={e.sub}
            first={i === 0}
            rank={i + 1}
            title={e.displayName}
            tag={e.sub === me ? "You" : undefined}
            highlight={e.sub === me}
            value={pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : formatResult(c, e, units)}
            detail={
              pct != null && then
                ? `${scoreText(c, then.score, units)} → ${scoreText(c, e.score, units)}`
                : `${c.metricKind === "weight_reps" ? `${scoreText(c, e.score, units)} · ` : ""}${format(parseISO(e.date), "MMM d, yyyy")}`
            }
          />
        ))
      )}
    </List>
  );
}

function ConsistencyBoard({ rows, today, me, optedIn }: { rows: ConsistencyRow[]; today: string; me?: string; optedIn: boolean }) {
  const { ranked, tooNew } = rankConsistency(rows, today);
  return (
    <List
      title="Consistency"
      subtitle={`Days on track over the last ${CONSISTENCY_DAYS / 7} weeks: planned workouts done and planned rest days. Injured days don't count against you.`}
      footer={tooNew.length ? `Not ranked yet (under ${CONSISTENCY_MIN_DAYS} days to count): ${tooNew.map((x) => x.r.displayName).join(", ")}.` : undefined}
    >
      {!optedIn && (
        <Notice>
          <Body>You&apos;re not on this board. Turn on “Also show my consistency” in Settings.</Body>
          <Button title="Open Settings" variant="link" onPress={() => router.navigate("/settings")} />
        </Notice>
      )}
      {ranked.length === 0 && tooNew.length === 0 ? (
        <Body muted style={{ textAlign: "center", padding: 24 }}>
          Nobody here shares their consistency yet. It&apos;s opt-in, in Settings.
        </Body>
      ) : (
        ranked.map(({ r, c }, i) => (
          <ListRow
            key={r.sub}
            first={i === 0}
            rank={i + 1}
            title={r.displayName}
            tag={r.sub === me ? "You" : undefined}
            highlight={r.sub === me}
            value={`${c.pct}%`}
            detail={`${c.on} of ${c.of} days · ${c.workouts} ${c.workouts === 1 ? "workout" : "workouts"}`}
          />
        ))
      )}
    </List>
  );
}
