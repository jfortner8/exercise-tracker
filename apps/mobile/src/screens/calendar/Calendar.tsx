import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarResponse } from "@et/core/api-types";
import { blockMetrics, workoutCategory } from "@et/core/activities";
import {
  chunkWeeks,
  compareWorkouts,
  displayStatus,
  DONE_STATUSES,
  injuriesOn,
  isMissedDay,
  kgToDisplay,
  weightUnit,
} from "@et/core/domain";
import { calendarGoal, goalOnDay } from "@et/core/goals";
import { calendarHabit, habitLevel, habitOnDay, HABITS } from "@et/core/habits";
import { startTimeLabel } from "@et/core/start-time";
import type { DayLog, DayResult, Profile, Workout } from "@et/core/types";
import type { CalendarView } from "@/api/calendar";
import { useTheme, type Theme } from "@/theme";

/** Everything one day shows, worked out the way the website's calendar does. */
export interface DayInfo {
  date: string;
  workouts: Workout[];
  log?: DayLog;
  results: DayResult[];
  injured: boolean;
  missed: boolean;
  pb: boolean;
}

/** Groups a calendar range by day, with the website's rules for missed and injured days. */
export function useDays(data: CalendarResponse | undefined, days: string[], today: string): Map<string, DayInfo> {
  return useMemo(() => {
    const out = new Map<string, DayInfo>();
    if (!data) return out;
    for (const d of days) {
      const workouts = data.workouts.filter((w) => w.date === d).sort(compareWorkouts);
      const results = data.results.filter((r) => r.date === d);
      const injured = injuriesOn(data.injuries, d, today).length > 0;
      out.set(d, {
        date: d,
        workouts,
        log: data.days.find((l) => l.date === d),
        results,
        injured,
        // A logged benchmark result means the day wasn't missed, even with no workout.
        missed: isMissedDay(d, today, data.startDate, [...workouts, ...results], injured),
        pb: results.some((r) => r.isPb),
      });
    }
    return out;
  }, [data, days, today]);
}

/** The colours for a workout block by its status as shown today (needs review, done, …). */
function blockColours(t: Theme, status: string) {
  if (DONE_STATUSES.has(status as Workout["status"])) return { bg: t.done, fg: t.doneFg, border: t.done, dashed: false };
  if (status === "planned") return { bg: t.plannedBg, fg: t.plannedFg, border: t.done, dashed: true };
  if (status === "needs_review") return { bg: t.warnBg, fg: t.text, border: t.warn, dashed: true };
  if (status === "missed") return { bg: t.missed, fg: t.missedFg, border: t.missed, dashed: false };
  return { bg: t.surface2, fg: t.muted, border: t.surface2, dashed: false }; // skipped
}

export function CalendarGrid({
  view,
  days,
  monthIndex,
  byDay,
  profile,
  today,
  startDate,
  onOpen,
}: {
  view: CalendarView;
  days: string[];
  monthIndex: number;
  byDay: Map<string, DayInfo>;
  profile: Profile;
  today: string;
  startDate: string | null;
  onOpen: (date: string) => void;
}) {
  const t = useTheme();
  const weeks = chunkWeeks(days);
  if (view === "week") {
    return (
      <View style={[styles.frame, { borderColor: t.border, backgroundColor: t.surface }]}>
        {days.map((d, i) => (
          <WeekRow key={d} info={byDay.get(d)} date={d} first={i === 0} profile={profile} today={today} startDate={startDate} onPress={() => onOpen(d)} />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.frame, { borderColor: t.border, backgroundColor: t.surface }]}>
      <View style={[styles.weekdays, { borderColor: t.border, backgroundColor: t.surface2 }]}>
        {days.slice(0, 7).map((d) => (
          <Text key={d} style={[styles.weekday, { color: t.muted }]}>
            {format(parseISO(d), "EEEEEE")}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={week[0]} style={[styles.week, wi > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
          {week.map((d, di) => (
            <DayTile
              key={d}
              date={d}
              info={byDay.get(d)}
              outside={parseISO(d).getMonth() !== monthIndex}
              last={di === 6}
              profile={profile}
              today={today}
              startDate={startDate}
              onPress={() => onOpen(d)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function DayNumber({ date, today, color }: { date: string; today: string; color: string }) {
  const t = useTheme();
  const isToday = date === today;
  return (
    <View style={[styles.dayNum, isToday && { backgroundColor: t.today }]}>
      <Text style={[styles.dayNumText, { color: isToday ? t.accentFg : color, fontWeight: isToday ? "700" : "500" }]}>
        {format(parseISO(date), "d")}
      </Text>
    </View>
  );
}

/** A month tile: workouts fill it (one = all of it, two = halves …), a footer strip below. */
function DayTile({
  date,
  info,
  outside,
  last,
  profile,
  today,
  startDate,
  onPress,
}: {
  date: string;
  info?: DayInfo;
  outside: boolean;
  last: boolean;
  profile: Profile;
  today: string;
  startDate: string | null;
  onPress: () => void;
}) {
  const t = useTheme();
  const workouts = info?.workouts ?? [];
  const label = `${format(parseISO(date), "EEEE, MMMM d")}${workouts.length ? `, ${workouts.length} workout${workouts.length === 1 ? "" : "s"}` : ""}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: t.border, backgroundColor: outside ? t.surface2 : t.surface, opacity: pressed ? 0.7 : 1 },
        !last && { borderRightWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {info?.injured && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.injury }]} />}
      <View style={{ flex: 1 }}>
        {workouts.length === 0 ? (
          <View style={[styles.blockArea, info?.missed && { backgroundColor: t.missed }]}>
            <DayNumber date={date} today={today} color={info?.missed ? t.missedFg : outside ? t.muted : t.text} />
          </View>
        ) : (
          workouts.map((w, i) => {
            const c = blockColours(t, today ? displayStatus(w, today) : w.status);
            return (
              <View
                key={w.id}
                style={[
                  styles.block,
                  { backgroundColor: c.bg, borderColor: c.border, borderStyle: c.dashed ? "dashed" : "solid", borderWidth: c.dashed ? 1 : 0 },
                  i > 0 && { borderTopWidth: 1, borderTopColor: t.surface },
                ]}
              >
                {i === 0 && <DayNumber date={date} today={today} color={c.fg} />}
                <Text style={styles.emoji}>{workoutCategory(w).emoji}</Text>
              </View>
            );
          })
        )}
      </View>
      {info?.pb && <Text style={[styles.star, { color: t.pb }]}>★</Text>}
      <Footer date={date} log={info?.log} profile={profile} today={today} startDate={startDate} compact />
    </Pressable>
  );
}

/** The week view: a row per day with its workouts named. */
function WeekRow({
  date,
  info,
  first,
  profile,
  today,
  startDate,
  onPress,
}: {
  date: string;
  info?: DayInfo;
  first: boolean;
  profile: Profile;
  today: string;
  startDate: string | null;
  onPress: () => void;
}) {
  const t = useTheme();
  const workouts = info?.workouts ?? [];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [!first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }, { opacity: pressed ? 0.7 : 1 }]}
    >
      {info?.injured && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.injury }]} />}
      <View style={styles.weekRow}>
        <View style={{ width: 46, alignItems: "center", paddingTop: 2 }}>
          <Text style={[styles.small, { color: t.muted }]}>{format(parseISO(date), "EEE")}</Text>
          <DayNumber date={date} today={today} color={t.text} />
          {info?.pb && <Text style={{ color: t.pb }}>★</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {workouts.length === 0 ? (
            info?.missed ? (
              <View style={[styles.chip, { backgroundColor: t.missed }]}>
                <Text style={[styles.chipTitle, { color: t.missedFg }]}>Missed</Text>
              </View>
            ) : (
              <Text style={[styles.small, { color: t.muted, paddingVertical: 6 }]}> </Text>
            )
          ) : (
            workouts.map((w) => {
              const status = today ? displayStatus(w, today) : w.status;
              const c = blockColours(t, status);
              const cat = workoutCategory(w);
              const metrics = [startTimeLabel(w, profile.timeZone, profile.clock), blockMetrics(w, profile.units)].filter(Boolean).join(" · ");
              return (
                <View
                  key={w.id}
                  style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border, borderStyle: c.dashed ? "dashed" : "solid", borderWidth: c.dashed ? 1 : 0 }]}
                >
                  <Text style={[styles.chipTitle, { color: c.fg, textDecorationLine: status === "skipped" ? "line-through" : "none" }]} numberOfLines={1}>
                    {cat.emoji} {w.title || cat.label}
                  </Text>
                  {metrics ? (
                    <Text style={[styles.small, { color: c.fg, opacity: 0.85 }]} numberOfLines={1}>
                      {metrics}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </View>
      <Footer date={date} log={info?.log} profile={profile} today={today} startDate={startDate} />
    </Pressable>
  );
}

/**
 * The strip under a day, as on the website: the calendar goal (✓ done, ✕ missed on a past day),
 * a note dot, bodyweight (a slash on past days without one), and the calendar habit's count.
 */
function Footer({
  date,
  log,
  profile,
  today,
  startDate,
  compact,
}: {
  date: string;
  log?: DayLog;
  profile: Profile;
  today: string;
  startDate: string | null;
  compact?: boolean;
}) {
  const t = useTheme();
  const goal = calendarGoal(profile);
  const habit = calendarHabit(profile);
  const done = goal ? goalOnDay(goal, date, today, startDate, log) : null;
  const count = habit ? habitOnDay(habit, date, today, startDate, profile.habitStarts?.[habit], log) : null;
  const weight = log?.weightKg != null ? Math.round(kgToDisplay(log.weightKg, profile.units) * 10) / 10 : null;
  const missedWeight = profile.trackWeight && weight == null && !!startDate && date >= startDate && date < today;
  const note = !!log?.notes?.trim();
  if (!goal && !habit && !profile.trackWeight && !note) return null;
  const cell = [styles.cell, { borderColor: t.border }];
  return (
    <View style={[styles.footer, { borderColor: t.border, height: compact ? 16 : 22 }]}>
      {goal && (
        <View style={[...cell, { backgroundColor: done ? t.done : done === false ? t.surface2 : t.surface, borderLeftWidth: 0 }]}>
          <Text style={[styles.footText, { color: done ? t.doneFg : t.danger, fontWeight: "800" }]}>
            {done ? "✓" : done === false && date < today ? "✕" : ""}
          </Text>
        </View>
      )}
      {note && !compact && (
        <View style={[...cell, { flex: 3, alignItems: "flex-start", paddingHorizontal: 6 }]}>
          <Text style={[styles.footText, { color: t.muted }]} numberOfLines={1}>
            {log?.notes?.trim()}
          </Text>
        </View>
      )}
      {note && compact && !goal && (
        <View style={[...cell, { flex: 0, width: 8, borderLeftWidth: 0 }]}>
          <View style={[styles.dot, { backgroundColor: t.muted }]} />
        </View>
      )}
      {profile.trackWeight && (
        <View style={[...cell, { backgroundColor: weight != null ? t.surface : t.surface2 }]}>
          {missedWeight && <View style={[styles.slash, { backgroundColor: t.muted }]} />}
          {weight != null && (
            <Text style={[styles.footText, { color: t.text }]} numberOfLines={1}>
              {compact ? Math.round(weight) : `${weight} ${weightUnit(profile.units)}`}
            </Text>
          )}
        </View>
      )}
      {habit && (
        <View style={[...cell, count != null && { backgroundColor: t.habit[habitLevel(habit, count)][0] }]}>
          {count != null && (
            <Text style={[styles.footText, { color: t.habit[habitLevel(habit, count)][1], fontWeight: "700" }]}>
              {compact ? count : `${count} ${HABITS[habit].noun(count)}`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: "hidden" },
  weekdays: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  week: { flexDirection: "row" },
  tile: { flex: 1, minHeight: 76, borderColor: "transparent" },
  blockArea: { flex: 1, padding: 2 },
  block: { flex: 1, padding: 2, overflow: "hidden", alignItems: "center" },
  dayNum: { alignSelf: "flex-start", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dayNumText: { fontSize: 11 },
  emoji: { fontSize: 13, lineHeight: 16 },
  star: { position: "absolute", top: 1, right: 2, fontSize: 11 },
  footer: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", borderLeftWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  footText: { fontSize: 10 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  slash: { position: "absolute", width: "140%", height: StyleSheet.hairlineWidth * 2, transform: [{ rotate: "-35deg" }] },
  weekRow: { flexDirection: "row", gap: 8, paddingVertical: 8, paddingRight: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  chipTitle: { fontSize: 14, fontWeight: "600" },
  small: { fontSize: 12 },
});
