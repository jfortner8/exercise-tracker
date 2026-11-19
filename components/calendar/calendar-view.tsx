"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Star } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { moveWorkoutAction, swapDaysAction } from "@/lib/actions";
import {
  chunkWeeks,
  compareWorkouts,
  detailsDurationSec,
  displayStatus,
  DONE_STATUSES,
  formatDistance,
  formatStartTime,
  isMissedDay,
  kgToDisplay,
  weightUnit,
  weekAdherence,
  ymd,
} from "@/lib/domain";
import type { BenchmarkDef, Clock, DayLog, DayResult, Injury, Profile, Routine, Units, Workout } from "@/lib/types";
import { blockMetrics, workoutCategory, type ActivityKey } from "@/lib/activities";
import { calendarHabit, habitLevel, habitOnDay, HABITS, type HabitKind } from "@/lib/habits";
import { HabitIcon } from "../habit-icon";
import { Button, cx } from "../ui";
import { Sheet } from "../sheet";
import { CopyWeekDialog } from "./copy-week-dialog";
import { DayDrawer } from "./day-drawer";

export interface CalendarProps {
  view: "month" | "week";
  title: string;
  anchor: string;
  monthIndex: number;
  prev: string;
  next: string;
  days: string[];
  workouts: Workout[];
  dayLogs: DayLog[];
  injuries: Injury[];
  benchmarks: BenchmarkDef[];
  profile: Profile;
  /** Earliest workout/day-log date; empty days before it are never "missed". */
  startDate: string | null;
  /** Benchmark results in view, flagged if they set a PB at the time. */
  results: DayResult[];
  /** The user's most recent activities (for the workout form's picker). */
  recent: ActivityKey[];
  /** Saved strength routines (for the workout form). */
  routines: Routine[];
}

/** Local "today" (browser timezone), stable across renders; empty during SSR. */
function useToday() {
  return useSyncExternalStore(
    () => () => {},
    () => ymd(new Date()),
    () => "",
  );
}

export function CalendarView(props: CalendarProps) {
  const { view, days, profile, injuries } = props;
  const habit = calendarHabit(profile);
  const habitStart = habit ? profile.habitStarts?.[habit] : undefined;
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [swapPrompt, setSwapPrompt] = useState<{ workout: Workout; to: string } | null>(null);
  const [, startTransition] = useTransition();
  const dndId = useId();

  type Move = { id: string; from: string; to: string; swap: boolean };
  const [workouts, applyMove] = useOptimistic(props.workouts, (state, m: Move) =>
    state.map((w) => {
      if (w.id === m.id) return { ...w, date: m.to };
      // Swapping sends the target day's planned workouts back to the dragged workout's day.
      if (m.swap && w.date === m.to && w.status === "planned") return { ...w, date: m.from };
      return w;
    }),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of workouts) map.set(w.date, [...(map.get(w.date) ?? []), w]);
    for (const list of map.values()) list.sort(compareWorkouts);
    return map;
  }, [workouts]);
  const logByDay = useMemo(() => new Map(props.dayLogs.map((d) => [d.date, d])), [props.dayLogs]);
  const resultsByDay = useMemo(() => {
    const map = new Map<string, DayResult[]>();
    for (const r of props.results) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return map;
  }, [props.results]);
  // A logged benchmark result means the day wasn't missed, even with no workout.
  const activityOn = (d: string) => [...(byDay.get(d) ?? []), ...(resultsByDay.get(d) ?? [])];
  const injuriesOn = (d: string) =>
    injuries.filter((i) => i.startDate <= d && (i.endDate ? d <= i.endDate : i.status !== "healed" && !!today && d <= today));

  const sensors = useSensors(
    // Mouse drags after a small move. Touch needs a long press, so a swipe that starts on a
    // planned workout still scrolls the page (a pointer sensor would grab it instead).
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  function move(w: Workout, to: string, swap: boolean) {
    startTransition(async () => {
      applyMove({ id: w.id, from: w.date, to, swap });
      await (swap ? swapDaysAction(w.date, w.id, to) : moveWorkoutAction(w.date, w.id, to));
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const w = e.active.data.current?.workout as Workout | undefined;
    const to = e.over?.id as string | undefined;
    if (!w || !to || to === w.date) return;
    // Dropping onto a day that already has a plan: ask whether to swap the days or add to it.
    if ((byDay.get(to) ?? []).some((o) => o.status === "planned")) setSwapPrompt({ workout: w, to });
    else move(w, to, false);
  }

  const weeks = chunkWeeks(days);
  const weekdayLabels = days.slice(0, 7).map((d) => ({ long: format(parseISO(d), "EEE"), short: format(parseISO(d), "EEEEEE") }));
  const href = (d: string, v = view) => `/?view=${v}&d=${d}`;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">{props.title}</h1>
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {(["month", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href(props.anchor, v)}
              className={cx(
                "rounded-md px-3 py-1 font-medium capitalize",
                view === v ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={href(props.prev)} aria-label="Previous" className="rounded-lg p-2 hover:bg-surface-2">
            <ChevronLeft className="size-4" />
          </Link>
          <Link
            href={href(today || props.anchor)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
          >
            Today
          </Link>
          <Link href={href(props.next)} aria-label="Next" className="rounded-lg p-2 hover:bg-surface-2">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <Legend />

      <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {/* Weekday header */}
          {/* On phones too in month view; the phone week view is a list whose rows name their day. */}
          <div
            className={cx(
              "grid-cols-7 border-b border-border bg-surface-2/50 text-xs font-medium uppercase tracking-wide text-muted md:grid md:grid-cols-[repeat(7,minmax(0,1fr))_8.5rem]",
              view === "week" ? "hidden" : "grid",
            )}
          >
            {weekdayLabels.map((l) => (
              <div key={l.long} className="px-1 py-1.5 md:px-2 md:py-2">
                <span className="md:hidden">{l.short}</span>
                <span className="hidden md:inline">{l.long}</span>
              </div>
            ))}
            <div className="hidden px-2 py-2 md:block">Week</div>
          </div>

          {weeks.map((week) => (
            <div
              key={week[0]}
              className={cx(
                "grid border-b border-border last:border-b-0 md:grid-cols-[repeat(7,minmax(0,1fr))_8.5rem]",
                view === "week" ? "grid-cols-1" : "grid-cols-7",
              )}
            >
              {week.map((d) => (
                <DayCell
                  key={d}
                  date={d}
                  today={today}
                  view={view}
                  outside={view === "month" && parseISO(d).getMonth() !== props.monthIndex}
                  workouts={byDay.get(d) ?? []}
                  log={logByDay.get(d)}
                  injured={injuriesOn(d).length > 0}
                  missed={isMissedDay(d, today, props.startDate, activityOn(d), injuriesOn(d).length > 0)}
                  habit={habit}
                  habitStart={habitStart}
                  startDate={props.startDate}
                  trackWeight={profile.trackWeight}
                  units={profile.units}
                  clock={profile.clock}
                  pb={(resultsByDay.get(d) ?? []).some((r) => r.isPb)}
                  onOpen={() => setSelected(d)}
                />
              ))}
              <WeekSummary
                week={week}
                byDay={byDay}
                logByDay={logByDay}
                profile={profile}
                today={today}
                startDate={props.startDate}
                isInjured={(d) => injuriesOn(d).length > 0}
                hasResult={(d) => resultsByDay.has(d)}
                onCopy={() => setCopyFrom(week[0])}
              />
            </div>
          ))}
        </div>
      </DndContext>

      {selected && (
        <DayDrawer
          key={selected}
          date={selected}
          today={today}
          workouts={byDay.get(selected) ?? []}
          log={logByDay.get(selected)}
          injuries={injuries}
          activeInjuries={injuriesOn(selected)}
          missed={isMissedDay(selected, today, props.startDate, activityOn(selected), injuriesOn(selected).length > 0)}
          benchmarks={props.benchmarks}
          results={resultsByDay.get(selected) ?? []}
          recent={props.recent}
          routines={props.routines}
          profile={profile}
          onClose={() => setSelected(null)}
        />
      )}
      {swapPrompt && (
        <SwapDialog
          workout={swapPrompt.workout}
          to={swapPrompt.to}
          targets={(byDay.get(swapPrompt.to) ?? []).filter((o) => o.status === "planned")}
          onChoose={(swap) => {
            move(swapPrompt.workout, swapPrompt.to, swap);
            setSwapPrompt(null);
          }}
          onClose={() => setSwapPrompt(null)}
        />
      )}
      {copyFrom && (
        <CopyWeekDialog
          from={copyFrom}
          defaultTo={ymd(addDays(parseISO(copyFrom), 7))}
          count={weeks.find((w) => w[0] === copyFrom)?.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0) ?? 0}
          onClose={() => setCopyFrom(null)}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-done" /> Done / rest
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-done bg-planned-bg" /> Planned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-warn bg-warn/15" />
        <span className="size-1.5 rounded-full bg-warn" /> Needs review
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-surface-2" /> Skipped
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-missed" /> Missed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="injury-stripe h-3 w-5 rounded border border-border" /> Injured
      </span>
      <span className="flex items-center gap-1.5">
        <Star className="size-3.5 fill-amber-400 text-amber-500" /> New PB
      </span>
      <span className="ml-auto hidden md:inline">Drag planned workouts to reschedule</span>
    </div>
  );
}

function DayCell({
  date,
  today,
  view,
  outside,
  workouts,
  log,
  injured,
  missed,
  habit,
  habitStart,
  startDate,
  trackWeight,
  units,
  clock,
  pb,
  onOpen,
}: {
  date: string;
  today: string;
  view: "month" | "week";
  outside: boolean;
  workouts: Workout[];
  log?: DayLog;
  injured: boolean;
  missed: boolean;
  habit: HabitKind | null;
  habitStart?: string;
  startDate: string | null;
  trackWeight: boolean;
  units: Units;
  clock?: Clock;
  /** A benchmark result on this day set a new PB. */
  pb: boolean;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const isToday = date === today;
  const d = parseISO(date);
  const dayLabel = (
    <span className="flex shrink-0 items-center gap-1">
      <span
        className={cx(
          "grid size-6 place-items-center rounded-full text-xs font-medium",
          isToday && "bg-today font-semibold text-accent-fg",
        )}
      >
        {format(d, "d")}
      </span>
      {view === "week" && <span className="text-xs opacity-80 md:hidden">{format(d, "EEE")}</span>}
    </span>
  );
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`${format(d, "EEEE, MMMM d")}${workouts.length ? `, ${workouts.length} workout${workouts.length === 1 ? "" : "s"}` : ""}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={cx(
        "group relative flex cursor-pointer flex-col border-border text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        view === "month"
          ? "min-h-20 border-r md:min-h-28"
          : // Phones list the week's days top to bottom; wider screens show seven columns.
            "min-h-14 border-t first:border-t-0 md:min-h-[26rem] md:border-r md:border-t-0",
        outside && "bg-surface-2/40 text-muted",
        injured && "injury-stripe",
        isOver && "ring-2 ring-inset ring-accent",
      )}
    >
      {pb && (
        <Star
          className="absolute right-1 top-1 z-10 size-3.5 fill-amber-400 text-amber-500 drop-shadow-sm md:size-4"
          aria-label="New personal best"
        />
      )}
      {/* Workouts fill the tile down to the footer: one = whole area, two = halves, three = thirds. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {workouts.length === 0 && missed ? (
          <div className="flex flex-1 flex-col bg-missed p-1 text-[11px] leading-tight text-missed-fg transition-[filter] group-hover:brightness-95 md:p-1.5 md:text-xs">
            <div className="flex items-center gap-1">
              {dayLabel}
              <span className="truncate font-medium">Missed</span>
            </div>
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex-1 p-1 transition-colors group-hover:bg-surface-2/60 md:p-1.5">{dayLabel}</div>
        ) : (
          workouts.map((w, i) => (
            <Block
              key={w.id}
              workout={w}
              today={today}
              detailed={view === "week"}
              dayLabel={i === 0 ? dayLabel : null}
              units={units}
              clock={clock}
              compact={view === "week" || workouts.length < 2 ? "none" : workouts.length === 2 ? "two" : "three"}
              clearCorner={i === 0 && pb}
            />
          ))
        )}
      </div>
      <DayFooter
        date={date}
        today={today}
        log={log}
        habit={habit}
        habitStart={habitStart}
        startDate={startDate}
        trackWeight={trackWeight}
        units={units}
        roomy={view === "week"}
      />
    </div>
  );
}

/** Counter background by level (habitLevel): green at 0 through intense red (theme tokens in globals.css). */
const DRINK_COLORS = [
  "bg-drink-0 text-drink-0-fg",
  "bg-drink-1 text-drink-1-fg",
  "bg-drink-2 text-drink-2-fg",
  "bg-drink-3 text-drink-3-fg",
  "bg-drink-4 text-drink-4-fg",
  "bg-drink-5 text-drink-5-fg",
  "bg-drink-6 text-drink-6-fg",
];

/**
 * Bottom strip of a day tile: note preview on the left, then bodyweight and drink count.
 * A phone's month tile is ~48px wide, so there the note shrinks to a dot, the weight to whole
 * units and the drinks to the coloured number. `roomy` (the week view's full-width rows) keeps it all.
 */
function DayFooter({
  date,
  today,
  log,
  habit,
  habitStart,
  startDate,
  trackWeight,
  units,
  roomy,
}: {
  date: string;
  today: string;
  log?: DayLog;
  /** The daily counter shown on the calendar, if any. */
  habit: HabitKind | null;
  habitStart?: string;
  /** The user's first day in the app; counts before it stay blank rather than 0. */
  startDate: string | null;
  trackWeight: boolean;
  units: Units;
  roomy: boolean;
}) {
  const note = log?.notes?.trim();
  const weight = log?.weightKg != null ? Math.round(kgToDisplay(log.weightKg, units) * 10) / 10 : null;
  const count = habit ? habitOnDay(habit, date, today, startDate, habitStart, log) : null;
  return (
    <div className="flex h-5 shrink-0 border-t border-border text-[10px] leading-none md:h-7 md:text-[11px]">
      <span
        className={cx(
          "flex min-w-0 flex-1 items-center bg-surface px-1 text-muted",
          !roomy && "max-md:justify-center max-md:px-0",
          !roomy && trackWeight && "max-md:w-3 max-md:flex-none",
        )}
        title={note}
      >
        {note && (
          <>
            <span className={cx("truncate", !roomy && "max-md:hidden")}>{note}</span>
            {!roomy && <span className="size-1.5 shrink-0 rounded-full bg-muted md:hidden" aria-label="Has a note" />}
          </>
        )}
      </span>
      {trackWeight && (
        // Always present when tracking so tiles line up; greyed out on days without a weigh-in.
        <span
          className={cx(
            "flex flex-1 items-center justify-center gap-0.5 border-l border-border font-medium tabular-nums",
            weight != null ? "bg-surface text-text" : "bg-surface-2",
          )}
          title={weight != null ? `Bodyweight ${weight} ${weightUnit(units)}` : "No weight logged"}
        >
          {weight != null &&
            (roomy ? (
              <>
                {weight}
                <span className="text-muted">{weightUnit(units)}</span>
              </>
            ) : (
              <>
                <span className="md:hidden">{Math.round(weight)}</span>
                <span className="hidden md:inline">{weight}</span>
                <span className="hidden text-muted md:inline">{weightUnit(units)}</span>
              </>
            ))}
        </span>
      )}
      {habit && (
        <span
          className={cx(
            "flex flex-1 items-center justify-center gap-0.5 border-l border-border font-semibold tabular-nums",
            count == null ? "bg-surface" : DRINK_COLORS[habitLevel(habit, count)],
          )}
          title={count != null ? `${count} ${HABITS[habit].noun(count)}` : undefined}
        >
          {count != null && (
            <>
              <HabitIcon kind={habit} className={cx("size-2.5 shrink-0 opacity-80 md:size-3", !roomy && "max-md:hidden")} />
              {count}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function Block({
  workout: w,
  today,
  detailed,
  dayLabel,
  units,
  clock,
  compact,
  clearCorner = false,
}: {
  workout: Workout;
  today: string;
  detailed: boolean;
  dayLabel: React.ReactNode;
  units: Units;
  clock?: Clock;
  /** Several workouts share a month tile: keep to the most important line(s). */
  compact: "none" | "two" | "three";
  /** Leave room in the top-right for the PB star. */
  clearCorner?: boolean;
}) {
  const status = today ? displayStatus(w, today) : w.status;
  const draggable = w.status === "planned";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: w.id,
    data: { workout: w },
    disabled: !draggable,
  });
  const done = DONE_STATUSES.has(status);
  const cat = workoutCategory(w);
  const metrics = [w.startTime && formatStartTime(w.startTime, clock), blockMetrics(w, units)].filter(Boolean).join(" · ") || undefined;
  // Don't repeat "Run" twice when the title is just the category.
  const titleIsCategory = w.title.trim().toLowerCase() === cat.label.toLowerCase();
  const struck = status === "skipped" && "line-through";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cx(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-0.5 text-[11px] leading-tight transition-[filter] group-hover:brightness-95 md:px-1.5 md:py-1 md:text-xs",
        !dayLabel && "border-t border-surface",
        // Only the one-line shared layout puts the title beside the star; otherwise it sits below.
        clearCorner && compact !== "none" && "pr-5 md:pr-6",
        done && "bg-done text-done-fg",
        status === "planned" &&
          "border border-dashed border-done bg-planned-bg text-planned-fg",
        status === "needs_review" && "border border-dashed border-warn bg-warn/15 text-text",
        status === "skipped" && "bg-surface-2 text-muted",
        status === "missed" && "bg-missed text-missed-fg",
        // touch-manipulation (not touch-none) leaves swipes to the page; a long press starts the drag.
        draggable && "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing",
        detailed && "max-md:min-h-14",
        isDragging && "z-20 opacity-80 shadow-lg",
      )}
      title={[w.title, `${cat.emoji} ${cat.label}`, metrics].filter(Boolean).join(" · ")}
    >
      {status === "needs_review" && <span className="absolute bottom-1 right-1 size-2 rounded-full bg-warn" />}
      {compact !== "none" ? (
        // Shared month tile: date + emoji + title on one line, metrics below when two share it.
        <>
          <div className="flex min-w-0 items-center gap-1">
            {dayLabel}
            <span className="shrink-0" aria-hidden>
              {cat.emoji}
            </span>
            {/* No room for even a word on a phone's shared tile; the emoji says what it is. */}
            <span className={cx("truncate font-medium max-md:hidden md:text-[11px]", struck)}>{w.title}</span>
          </div>
          {compact === "two" && metrics && (
            <span className="hidden truncate tabular-nums opacity-80 md:block">{metrics}</span>
          )}
        </>
      ) : (
        <>
          {dayLabel && <div className="flex shrink-0">{dayLabel}</div>}
          {/* Title, category and basics, centered in the block. */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden text-center">
            {/* A phone's month tile: emoji on top, then up to two lines of title. */}
            {!detailed && (
              <span className="text-sm leading-none md:hidden" aria-hidden>
                {cat.emoji}
              </span>
            )}
            {!titleIsCategory && (
              <span
                className={cx(
                  "max-w-full font-semibold",
                  // Hyphenate long words ("Inter-vals") rather than splitting them anywhere.
                  // Month titles run a size smaller so more of them fits.
                  detailed ? "truncate" : "hyphens-auto text-[10px] max-md:line-clamp-2 md:truncate md:text-[11px]",
                  struck,
                )}
              >
                {w.title}
              </span>
            )}
            <span
              className={cx(
                "max-w-full truncate",
                titleIsCategory
                  ? cx("font-semibold", !detailed && "text-[10px] md:text-[11px]", struck)
                  : cx("opacity-90", !detailed && "hidden md:block"),
              )}
            >
              {/* On a phone's month tile the emoji already sits on top. */}
              <span className={cx(!detailed && "max-md:hidden")} aria-hidden>
                {cat.emoji}
              </span>{" "}
              {cat.label}
            </span>
            {metrics && (
              <span className={cx("max-w-full truncate tabular-nums opacity-80", !detailed && "hidden md:block")}>{metrics}</span>
            )}
            {detailed && w.originalDate && (
              <span className="opacity-70">moved from {format(parseISO(w.originalDate), "EEE")}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function WeekSummary({
  week,
  byDay,
  logByDay,
  profile,
  today,
  startDate,
  isInjured,
  hasResult,
  onCopy,
}: {
  week: string[];
  byDay: Map<string, Workout[]>;
  logByDay: Map<string, DayLog>;
  profile: Profile;
  today: string;
  startDate: string | null;
  isInjured: (d: string) => boolean;
  hasResult: (d: string) => boolean;
  onCopy: () => void;
}) {
  const ws = week.flatMap((d) => byDay.get(d) ?? []).filter((w) => w.type !== "rest");
  const done = ws.filter((w) => DONE_STATUSES.has(w.status));
  const a = weekAdherence(week, byDay, today, startDate, isInjured, hasResult);
  const parts = [
    a.asPlanned && `${a.asPlanned} as planned`,
    a.rest && `${a.rest} rest`,
    a.moved && `${a.moved} moved`,
    a.substituted && `${a.substituted} substituted`,
    a.skipped && `${a.skipped} skipped`,
    a.missed && `${a.missed} missed`,
  ].filter(Boolean);
  const minutes = Math.round(done.reduce((s, w) => s + (detailsDurationSec(w.actual ?? w.planned) ?? 0), 0) / 60);
  const meters = done.reduce((s, w) => s + ((w.actual ?? w.planned)?.distanceM ?? 0), 0);
  // Weeks entirely before the counter's start (or in the future) have nothing to count.
  const habit = calendarHabit(profile);
  const counts = habit
    ? week.map((d) => habitOnDay(habit, d, today, startDate, profile.habitStarts?.[habit], logByDay.get(d))).filter((n) => n != null)
    : [];
  const habitTotal = counts.reduce((s, n) => s + n, 0);

  return (
    // Phones: one wrapping line under the week. Wider screens: a column beside it.
    <div className="col-span-full flex items-center gap-2 border-t border-border bg-surface-2/40 px-2 py-1.5 text-xs text-muted md:col-span-1 md:flex-col md:items-start md:gap-1 md:border-t-0 md:py-2">
      {/* The stats wrap among themselves on phones, leaving the copy button at the end of the row. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 md:contents">
      {a.elapsed > 0 ? (
        <div className="whitespace-nowrap" title="Days you trained or rested on purpose, out of the days so far">
          <span className="text-sm font-semibold text-text">{a.onTrack}</span>/{a.elapsed} days
        </div>
      ) : (
        <div>{ws.length} planned</div>
      )}
      {parts.length > 0 && <div className="leading-snug">{parts.join(" · ")}</div>}
      {minutes > 0 && <div className="whitespace-nowrap">{minutes} min</div>}
      {meters > 0 && <div className="whitespace-nowrap">{formatDistance(meters, profile.units)}</div>}
      {habit && counts.length > 0 && (
        <div className="flex items-center gap-1" title={`${habitTotal} ${HABITS[habit].noun(habitTotal)} this week`}>
          <HabitIcon kind={habit} className="size-3" /> {habitTotal}
        </div>
      )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Copy week"
        className="size-8 shrink-0 px-0 text-xs md:-ml-1 md:mt-auto md:h-6 md:w-auto md:px-1.5"
        onClick={onCopy}
      >
        <Copy className="size-3.5 md:size-3" /> <span className="hidden md:inline">Copy week</span>
      </Button>
    </div>
  );
}

function SwapDialog({
  workout,
  to,
  targets,
  onChoose,
  onClose,
}: {
  workout: Workout;
  to: string;
  targets: Workout[];
  onChoose: (swap: boolean) => void;
  onClose: () => void;
}) {
  const [fromLabel, toLabel] = [workout.date, to].map((d) => format(parseISO(d), "EEE MMM d"));
  return (
    <Sheet variant="dialog" title="That day already has a plan" onClose={onClose}>
      <p className="text-sm text-muted">
        {toLabel} has {targets.map((t) => t.title).join(", ")} planned. Swap so {targets.length === 1 ? "it moves" : "they move"} to{" "}
        {fromLabel}, or add {workout.title} alongside?
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onChoose(false)}>Add to {format(parseISO(to), "EEE")}</Button>
        <Button variant="primary" onClick={() => onChoose(true)}>
          Swap days
        </Button>
      </div>
    </Sheet>
  );
}
