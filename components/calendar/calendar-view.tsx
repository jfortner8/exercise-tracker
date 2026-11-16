"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Moon, Wine } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { moveWorkoutAction, swapDaysAction } from "@/lib/actions";
import {
  chunkWeeks,
  detailsDurationSec,
  displayStatus,
  DONE_STATUSES,
  formatDistance,
  isMissedDay,
  weekAdherence,
  ymd,
} from "@/lib/domain";
import type { BenchmarkDef, DayLog, Injury, Profile, Workout } from "@/lib/types";
import { TYPE_META } from "@/lib/workout-types";
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
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [workouts]);
  const logByDay = useMemo(() => new Map(props.dayLogs.map((d) => [d.date, d])), [props.dayLogs]);
  const injuriesOn = (d: string) =>
    injuries.filter((i) => i.startDate <= d && (i.endDate ? d <= i.endDate : i.status !== "healed" && !!today && d <= today));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
  const weekdayLabels = days.slice(0, 7).map((d) => format(parseISO(d), "EEE"));
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
          <div className="hidden grid-cols-[repeat(7,minmax(0,1fr))_8.5rem] border-b border-border bg-surface-2/50 text-xs font-medium uppercase tracking-wide text-muted md:grid">
            {weekdayLabels.map((l) => (
              <div key={l} className="px-2 py-2">
                {l}
              </div>
            ))}
            <div className="px-2 py-2">Week</div>
          </div>

          {weeks.map((week) => (
            <div
              key={week[0]}
              className="grid grid-cols-7 border-b border-border last:border-b-0 md:grid-cols-[repeat(7,minmax(0,1fr))_8.5rem]"
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
                  missed={isMissedDay(d, today, props.startDate, byDay.get(d) ?? [], injuriesOn(d).length > 0)}
                  trackDrinks={profile.trackDrinks}
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
          missed={isMissedDay(selected, today, props.startDate, byDay.get(selected) ?? [], injuriesOn(selected).length > 0)}
          benchmarks={props.benchmarks}
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
  trackDrinks,
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
  trackDrinks: boolean;
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
        "group relative flex cursor-pointer flex-col border-r border-border text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        view === "month" ? "min-h-20 md:min-h-28" : "min-h-40 md:min-h-[26rem]",
        outside && "bg-surface-2/40 text-muted",
        injured && "injury-stripe",
        isOver && "ring-2 ring-inset ring-accent",
      )}
    >
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
            <Block key={w.id} workout={w} today={today} detailed={view === "week"} dayLabel={i === 0 ? dayLabel : null} />
          ))
        )}
      </div>
      <DayFooter date={date} today={today} log={log} trackDrinks={trackDrinks} />
    </div>
  );
}

/** Drink count background: green at 0 through intense red at 6+ (theme tokens in globals.css). */
const DRINK_COLORS = [
  "bg-drink-0 text-drink-0-fg",
  "bg-drink-1 text-drink-1-fg",
  "bg-drink-2 text-drink-2-fg",
  "bg-drink-3 text-drink-3-fg",
  "bg-drink-4 text-drink-4-fg",
  "bg-drink-5 text-drink-5-fg",
  "bg-drink-6 text-drink-6-fg",
];

/** Bottom strip of a day tile, split down the middle: note preview on the left, drink count on the right. */
function DayFooter({ date, today, log, trackDrinks }: { date: string; today: string; log?: DayLog; trackDrinks: boolean }) {
  const note = log?.notes?.trim();
  // Future days stay blank; from the day itself onward an unlogged day counts as 0.
  const drinks = today && date <= today ? (log?.drinks ?? 0) : null;
  return (
    <div className="flex h-5 shrink-0 border-t border-border text-[10px] leading-none md:h-7 md:text-[11px]">
      <span className="flex min-w-0 flex-1 items-center bg-surface px-1 text-muted" title={note}>
        {note && <span className="truncate">{note}</span>}
      </span>
      {trackDrinks && (
        <span
          className={cx(
            "flex flex-1 items-center justify-center border-l border-border font-semibold tabular-nums",
            drinks == null ? "bg-surface" : DRINK_COLORS[Math.min(drinks, DRINK_COLORS.length - 1)],
          )}
          title={drinks != null ? `${drinks} drink${drinks === 1 ? "" : "s"}` : undefined}
        >
          {drinks}
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
}: {
  workout: Workout;
  today: string;
  detailed: boolean;
  dayLabel: React.ReactNode;
}) {
  const status = today ? displayStatus(w, today) : w.status;
  const draggable = w.status === "planned";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: w.id,
    data: { workout: w },
    disabled: !draggable,
  });
  const meta = TYPE_META[w.type];
  const done = DONE_STATUSES.has(status);
  const rest = w.type === "rest";
  const dur = detailsDurationSec(done ? (w.actual ?? w.planned) : w.planned);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cx(
        "relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-1 py-0.5 text-[11px] leading-tight transition-[filter] group-hover:brightness-95 md:px-1.5 md:py-1 md:text-xs",
        !dayLabel && "border-t border-surface",
        done && "bg-done text-done-fg",
        status === "planned" &&
          "border border-dashed border-done bg-planned-bg text-planned-fg",
        status === "needs_review" && "border border-dashed border-warn bg-warn/15 text-text",
        status === "skipped" && "bg-surface-2 text-muted",
        status === "missed" && "bg-missed text-missed-fg",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "z-20 opacity-80 shadow-lg",
      )}
      title={`${meta.label}: ${w.title}`}
    >
      {status === "needs_review" && <span className="absolute right-1 top-1 size-2 rounded-full bg-warn" />}
      <div className="flex min-w-0 items-center gap-1">
        {dayLabel}
        {rest && <Moon className="size-3 shrink-0" aria-hidden />}
        <span className={cx("truncate font-medium", status === "skipped" && "line-through")}>{w.title}</span>
      </div>
      {detailed && (
        <span className="block opacity-80">
          {meta.label}
          {dur ? ` · ${Math.round(dur / 60)} min` : ""}
          {w.originalDate ? ` · moved from ${format(parseISO(w.originalDate), "EEE")}` : ""}
        </span>
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
  onCopy,
}: {
  week: string[];
  byDay: Map<string, Workout[]>;
  logByDay: Map<string, DayLog>;
  profile: Profile;
  today: string;
  startDate: string | null;
  isInjured: (d: string) => boolean;
  onCopy: () => void;
}) {
  const ws = week.flatMap((d) => byDay.get(d) ?? []).filter((w) => w.type !== "rest");
  const done = ws.filter((w) => DONE_STATUSES.has(w.status));
  const a = weekAdherence(week, byDay, today, startDate, isInjured);
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
  const drinks = week.reduce((s, d) => s + (logByDay.get(d)?.drinks ?? 0), 0);

  return (
    <div className="col-span-7 flex items-center gap-3 border-t border-border bg-surface-2/40 px-2 py-1.5 text-xs text-muted md:col-span-1 md:flex-col md:items-start md:gap-1 md:border-t-0 md:py-2">
      {a.elapsed > 0 ? (
        <div className="whitespace-nowrap" title="Days you trained or rested on purpose, out of the days so far">
          <span className="text-sm font-semibold text-text">{a.onTrack}</span>/{a.elapsed} days
        </div>
      ) : (
        <div>{ws.length} planned</div>
      )}
      {parts.length > 0 && <div className="leading-snug">{parts.join(" · ")}</div>}
      {minutes > 0 && <div>{minutes} min</div>}
      {meters > 0 && <div>{formatDistance(meters, profile.units)}</div>}
      {profile.trackDrinks && (
        <div className="flex items-center gap-1">
          <Wine className="size-3" /> {drinks}
        </div>
      )}
      <Button size="sm" variant="ghost" className="-ml-1 ml-auto h-6 px-1.5 text-xs md:ml-0 md:mt-auto" onClick={onCopy}>
        <Copy className="size-3" /> Copy week
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
