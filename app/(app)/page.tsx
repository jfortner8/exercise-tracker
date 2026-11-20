import { addMonths, addWeeks, format, parseISO } from "date-fns";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { recentActivities } from "@/lib/activities";
import { calendarResults, eachDay, monthGridRange, weekRange, ymd } from "@/lib/domain";
import { requireProfile, requireToday } from "@/lib/dal";
import {
  firstEntryDate,
  listAllResults,
  listBenchmarks,
  listDays,
  listInjuries,
  listRoutines,
  listWorkouts,
  recentWorkouts,
} from "@/lib/db/repo";

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-9 w-64 rounded-lg bg-surface-2" />
      <div className="h-[70vh] rounded-xl bg-surface-2" />
    </div>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const [{ user, profile }, today] = await Promise.all([requireProfile(), requireToday()]);
  const view = sp.view === "week" ? "week" : "month";
  // "Today" where the user is: the server runs in UTC, which is already tomorrow on a US evening.
  const anchorStr = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const anchor = parseISO(anchorStr);

  const { start, end } =
    view === "month" ? monthGridRange(anchor, profile.weekStartsOn) : weekRange(anchor, profile.weekStartsOn);
  const [s, e] = [ymd(start), ymd(end)];

  const [workouts, days, injuries, benchmarks, startDate, allResults, recent, routines] = await Promise.all([
    listWorkouts(user.sub, s, e),
    listDays(user.sub, s, e),
    listInjuries(user.sub),
    listBenchmarks(user.sub),
    firstEntryDate(user.sub),
    // All results (one small query): earlier history decides whether a result in view was a PB.
    listAllResults(user.sub),
    recentWorkouts(user.sub, today),
    profile.hasRoutines ? listRoutines(user.sub) : Promise.resolve([]),
  ]);

  const title = view === "month" ? format(anchor, "MMMM yyyy") : `Week of ${format(start, "MMM d, yyyy")}`;
  const step = (n: number) =>
    ymd(view === "month" ? addMonths(anchor, n) : addWeeks(anchor, n));

  return (
    <CalendarView
      view={view}
      title={title}
      anchor={anchorStr}
      monthIndex={anchor.getMonth()}
      prev={step(-1)}
      next={step(1)}
      days={eachDay(start, end)}
      workouts={workouts}
      dayLogs={days}
      injuries={injuries}
      benchmarks={benchmarks}
      profile={profile}
      startDate={startDate}
      results={calendarResults(benchmarks, allResults, s, e)}
      recent={recentActivities(recent)}
      routines={routines}
    />
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}
