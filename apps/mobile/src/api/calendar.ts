import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, addWeeks, parseISO } from "date-fns";
import type { CalendarResponse } from "@et/core/api-types";
import { eachDay, monthGridRange, weekRange, ymd } from "@et/core/domain";
import { api } from "./client";

export type CalendarView = "month" | "week";

/** The days a month or week screen shows, as the website works them out (whole weeks). */
export function calendarDays(anchor: string, view: CalendarView, weekStartsOn: 0 | 1) {
  const a = parseISO(anchor);
  const { start, end } = view === "month" ? monthGridRange(a, weekStartsOn) : weekRange(a, weekStartsOn);
  return { from: ymd(start), to: ymd(end), days: eachDay(start, end) };
}

export const stepAnchor = (anchor: string, view: CalendarView, n: number) =>
  ymd(view === "month" ? addMonths(parseISO(anchor), n) : addWeeks(parseISO(anchor), n));

/** One calendar range: workouts, day logs, injuries, results, routines. Cached per range. */
export const useCalendar = (from: string | undefined, to: string | undefined) =>
  useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => api<CalendarResponse>(`/calendar?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
  });

/**
 * A write that changes what the calendar shows. Afterwards every cached range and `me` (whose tabs
 * can change, for example Sports after a first sport workout) refresh.
 */
export function useCalendarWrite<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(["calendar", "me", "race-distances", "sports"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}
