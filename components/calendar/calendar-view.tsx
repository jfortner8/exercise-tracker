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
import { ChevronLeft, ChevronRight, Copy, NotebookPen, Wine } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { moveWorkoutAction } from "@/lib/actions";
import {
  chunkWeeks,
  detailsDurationSec,
  displayStatus,
  DONE_STATUSES,
  formatDistance,
  ymd,
} from "@/lib/domain";
import type { BenchmarkDef, DayLog, Injury, Profile, Workout } from "@/lib/types";
import { TYPE_META } from "@/lib/workout-types";
import { Button, cx } from "../ui";
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
  const [, startTransition] = useTransition();
  const dndId = useId();

  const [workouts, applyMove] = useOptimistic(props.workouts, (state, m: { id: string; to: string }) =>
    state.map((w) => (w.id === m.id ? { ...w, date: m.to } : w)),
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

  function onDragEnd(e: DragEndEvent) {
    const w = e.active.data.current?.workout as Workout | undefined;
    const to = e.over?.id as string | undefined;
    if (!w || !to || to === w.date) return;
    startTransition(async () => {
      applyMove({ id: w.id, to });
      await moveWorkoutAction(w.date, w.id, to);
    });
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
                  trackDrinks={profile.trackDrinks}
                  onOpen={() => setSelected(d)}
                />
              ))}
              <WeekSummary
                week={week}
                byDay={byDay}
                logByDay={logByDay}
                profile={profile}
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
          benchmarks={props.benchmarks}
          profile={profile}
          onClose={() => setSelected(null)}
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
        <span className="h-3 w-5 rounded bg-orange-500" /> Done
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-orange-500" /> Planned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-orange-500 bg-warn/15" />
        <span className="size-1.5 rounded-full bg-warn" /> Needs review
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-surface-2 line-through" /> Skipped / missed
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
  trackDrinks: boolean;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const isToday = date === today;
  const d = parseISO(date);
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`${format(d, "EEEE, MMMM d")}${workouts.length ? `, ${workouts.length} workout${workouts.length === 1 ? "" : "s"}` : ""}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={cx(
        "group relative flex cursor-pointer flex-col gap-1 border-r border-border p-1 text-left outline-none transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2 md:p-1.5",
        view === "month" ? "min-h-20 md:min-h-28" : "min-h-40 md:min-h-[26rem]",
        outside && "bg-surface-2/40 text-muted",
        injured && "injury-stripe",
        isOver && "bg-accent/10 ring-2 ring-inset ring-accent",
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cx(
            "grid size-6 place-items-center rounded-full text-xs font-medium",
            isToday && "bg-today font-semibold text-accent-fg",
          )}
        >
          {format(d, "d")}
        </span>
        {view === "week" && <span className="text-xs text-muted md:hidden">{format(d, "EEE")}</span>}
        <span className="ml-auto flex items-center gap-1 text-muted">
          {log?.notes && <NotebookPen className="size-3" aria-label="Has note" />}
          {trackDrinks && !!log?.drinks && (
            <span className="flex items-center text-[10px]" title={`${log.drinks} drinks`}>
              <Wine className="size-3" />
              {log.drinks}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {workouts.map((w) => (
          <Chip key={w.id} workout={w} today={today} detailed={view === "week"} />
        ))}
      </div>
    </div>
  );
}

function Chip({ workout: w, today, detailed }: { workout: Workout; today: string; detailed: boolean }) {
  const status = today ? displayStatus(w, today) : w.status;
  const draggable = w.status === "planned";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: w.id,
    data: { workout: w },
    disabled: !draggable,
  });
  const meta = TYPE_META[w.type];
  const done = DONE_STATUSES.has(w.status);
  const dropped = w.status === "skipped" || w.status === "missed";
  const dur = detailsDurationSec(done ? (w.actual ?? w.planned) : w.planned);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cx(
        "relative rounded-md px-1.5 py-0.5 text-[11px] leading-tight md:text-xs",
        done && meta.solid,
        status === "planned" && cx("border border-dashed bg-surface", meta.outline),
        status === "needs_review" && cx("border border-dashed bg-warn/10", meta.outline),
        dropped && "bg-surface-2 text-muted line-through",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "z-20 opacity-80 shadow-lg",
      )}
      title={`${meta.label}: ${w.title}`}
    >
      {status === "needs_review" && (
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warn ring-2 ring-surface" />
      )}
      <span className="line-clamp-2 font-medium md:truncate">{w.title}</span>
      {detailed && (
        <span className="mt-0.5 block opacity-80">
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
  onCopy,
}: {
  week: string[];
  byDay: Map<string, Workout[]>;
  logByDay: Map<string, DayLog>;
  profile: Profile;
  onCopy: () => void;
}) {
  const ws = week.flatMap((d) => byDay.get(d) ?? []).filter((w) => w.type !== "rest");
  const done = ws.filter((w) => DONE_STATUSES.has(w.status));
  const minutes = Math.round(done.reduce((s, w) => s + (detailsDurationSec(w.actual ?? w.planned) ?? 0), 0) / 60);
  const meters = done.reduce((s, w) => s + ((w.actual ?? w.planned)?.distanceM ?? 0), 0);
  const drinks = week.reduce((s, d) => s + (logByDay.get(d)?.drinks ?? 0), 0);

  return (
    <div className="col-span-7 flex items-center gap-3 border-t border-border bg-surface-2/40 px-2 py-1.5 text-xs text-muted md:col-span-1 md:flex-col md:items-start md:gap-1 md:border-t-0 md:py-2">
      <div>
        <span className="text-sm font-semibold text-text">{done.length}</span>/{ws.length} done
      </div>
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
