import { addMonths, addWeeks, format, parseISO } from "date-fns";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { eachDay, monthGridRange, weekRange, ymd } from "@/lib/domain";
import { requireProfile } from "@/lib/dal";
import { listBenchmarks, listDays, listInjuries, listWorkouts } from "@/lib/db/repo";

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
  const { user, profile } = await requireProfile();
  const view = sp.view === "week" ? "week" : "month";
  const anchorStr = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : ymd(new Date());
  const anchor = parseISO(anchorStr);

  const { start, end } =
    view === "month" ? monthGridRange(anchor, profile.weekStartsOn) : weekRange(anchor, profile.weekStartsOn);
  const [s, e] = [ymd(start), ymd(end)];

  const [workouts, days, injuries, benchmarks] = await Promise.all([
    listWorkouts(user.sub, s, e),
    listDays(user.sub, s, e),
    listInjuries(user.sub),
    listBenchmarks(user.sub),
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
