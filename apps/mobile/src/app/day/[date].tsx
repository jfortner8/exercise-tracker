import { format, parseISO } from "date-fns";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { workoutCategory } from "@et/core/activities";
import { displayStatus, displayToKg, kgToDisplay, weightUnit } from "@et/core/domain";
import { activeGoals, goalDone } from "@et/core/goals";
import { habitCount, HABITS, profileHabits } from "@et/core/habits";
import { startTimeLabel } from "@et/core/start-time";
import type { Workout } from "@et/core/types";
import { calendarDays, useCalendar, useCalendarWrite } from "@/api/calendar";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { useDays } from "@/screens/calendar/Calendar";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText, Screen } from "@/ui";

const STATUS: Record<string, string> = {
  planned: "Planned",
  completed: "Done",
  partial: "Partly done",
  missed: "Missed",
  skipped: "Skipped",
  needs_review: "How did it go?",
  substituted: "Did something else",
};

/** One day, as a sheet over the calendar: goals, workouts with quick answers, notes, weight, habits. */
export default function DaySheet() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const signedIn = useSession().status === "signedIn";
  const me = useMe(signedIn);
  const profile = me.data?.profile;
  const today = me.data?.today ?? "";
  // The same range as the month the day is in, so it comes straight from the calendar's cache.
  const range = profile && date ? calendarDays(date, "month", profile.weekStartsOn) : undefined;
  const cal = useCalendar(range?.from, range?.to);
  const info = useDays(cal.data, date ? [date] : [], today).get(date);
  const write = useCalendarWrite((f: () => Promise<unknown>) => f());
  if (!signedIn) return <Redirect href="/sign-in" />;

  const run = (f: () => Promise<unknown>) => write.mutate(f);
  return (
    <>
      <Stack.Screen options={{ title: date ? format(parseISO(date), "EEEE, MMMM d") : "" }} />
      <Screen>
        <ErrorText>{(write.error ?? cal.error)?.message}</ErrorText>
        {profile && info && (
          <>
            {activeGoals(profile).length > 0 && date <= today && (
              <Card>
                <Body style={{ fontWeight: "600", marginBottom: 6 }}>Daily goals</Body>
                {activeGoals(profile).map((g) => {
                  const on = goalDone(info.log, g.id);
                  return (
                    <Button
                      key={g.id}
                      variant={on ? "primary" : "secondary"}
                      title={`${on ? "✓ " : ""}${g.emoji ? `${g.emoji} ` : ""}${g.name}`}
                      onPress={() => run(() => api(`/days/${date}/goals/${g.id}`, { method: "PUT", body: { done: !on } }))}
                    />
                  );
                })}
              </Card>
            )}

            <Body style={{ fontWeight: "600", marginBottom: 8 }}>Workouts</Body>
            {info.workouts.map((w) => (
              <WorkoutCard key={w.id} w={w} today={today} zone={profile.timeZone} clock={profile.clock} run={run} />
            ))}
            {info.workouts.length === 0 && (
              <>
                {info.missed && <Body style={{ marginBottom: 8 }}>Nothing was planned or logged for this day.</Body>}
                <Button title="Mark as rest day" variant="secondary" onPress={() => run(() => api(`/days/${date}/rest`, { method: "POST" }))} />
              </>
            )}
            <Body muted style={{ marginTop: 8, marginBottom: 12 }}>
              Adding and editing workouts comes next; until then use the website.
            </Body>

            <DayLogCard key={JSON.stringify(info.log ?? {})} date={date} run={run} log={info.log} profile={profile} busy={write.isPending} />
          </>
        )}
      </Screen>
    </>
  );
}

function WorkoutCard({
  w,
  today,
  zone,
  clock,
  run,
}: {
  w: Workout;
  today: string;
  zone?: string;
  clock?: "12h" | "24h";
  run: (f: () => Promise<unknown>) => void;
}) {
  const t = useTheme();
  const status = today ? displayStatus(w, today) : w.status;
  const cat = workoutCategory(w);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  const resolve = (s: "completed" | "missed" | "skipped", r?: string) =>
    run(() => api(`/workouts/${w.date}/${w.id}/resolve`, { body: { status: s, ...(r ? { reason: r } : {}) } }));
  return (
    <Card>
      <Body style={{ fontWeight: "600" }}>
        {cat.emoji} {w.title || cat.label}
      </Body>
      <Body muted>
        {[startTimeLabel(w, zone, clock), STATUS[status] ?? status].filter(Boolean).join(" · ")}
      </Body>
      {w.reason ? <Body muted>↳ {w.reason}</Body> : null}
      {(status === "planned" || status === "needs_review") &&
        (skipping ? (
          <View style={{ marginTop: 8 }}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why? Sick, travel, wedding…"
              placeholderTextColor={t.muted}
              style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, color: t.text }}
            />
            <Button title="Save" disabled={!reason.trim()} onPress={() => resolve("skipped", reason.trim())} />
            <Button title="Cancel" variant="link" onPress={() => setSkipping(false)} />
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            <Button title="✓ Done" onPress={() => resolve("completed")} />
            <Button title="Skipped…" variant="secondary" onPress={() => setSkipping(true)} />
            {status === "needs_review" && <Button title="Missed" variant="danger" onPress={() => resolve("missed")} />}
          </View>
        ))}
      <Pressable accessibilityRole="button" onPress={() => run(() => api(`/workouts/${w.date}/${w.id}`, { method: "DELETE" }))}>
        <Text style={{ color: t.danger, marginTop: 8 }}>Delete</Text>
      </Pressable>
    </Card>
  );
}

function DayLogCard({
  date,
  log,
  profile,
  run,
  busy,
}: {
  date: string;
  log?: import("@et/core/types").DayLog;
  profile: import("@et/core/types").Profile;
  run: (f: () => Promise<unknown>) => void;
  busy: boolean;
}) {
  const t = useTheme();
  const habits = profileHabits(profile);
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [weight, setWeight] = useState(log?.weightKg != null ? String(Math.round(kgToDisplay(log.weightKg, profile.units) * 10) / 10) : "");
  const [counts, setCounts] = useState(() => Object.fromEntries(habits.map((k) => [k, habitCount(log, k) ?? 0])) as Record<string, number>);
  const weightNum = weight.trim() === "" ? null : Number(weight);
  const input = { borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, color: t.text, backgroundColor: t.surface };
  return (
    <Card>
      <Body style={{ fontWeight: "600", marginBottom: 6 }}>Day notes</Body>
      <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Travel, wedding, sick, slept badly…" placeholderTextColor={t.muted} style={[input, { minHeight: 70 }]} />
      {profile.trackWeight && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Body muted>Weight</Body>
          <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={t.muted} style={[input, { width: 90 }]} />
          <Body muted>{weightUnit(profile.units)}</Body>
        </View>
      )}
      {habits.map((k) => {
        const h = HABITS[k];
        const bump = (by: number) => setCounts((c) => ({ ...c, [k]: Math.min(h.max, Math.max(0, (c[k] ?? 0) + by)) }));
        return (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
            <Body muted style={{ flex: 1 }}>{h.short}</Body>
            <Button title="−" variant="secondary" onPress={() => bump(-h.step)} />
            <Body style={{ width: 32, textAlign: "center", fontWeight: "700" }}>{counts[k] ?? 0}</Body>
            <Button title="+" variant="secondary" onPress={() => bump(1)} />
          </View>
        );
      })}
      <Button
        title="Save"
        loading={busy}
        disabled={weightNum != null && (!isFinite(weightNum) || weightNum <= 0)}
        onPress={() =>
          run(() =>
            api(`/days/${date}`, {
              method: "PUT",
              body: {
                notes,
                ...Object.fromEntries(habits.map((k) => [HABITS[k].field, counts[k] ?? 0])),
                ...(profile.trackWeight ? { weightKg: weightNum == null ? null : displayToKg(weightNum, profile.units) } : {}),
              },
            }),
          )
        }
      />
    </Card>
  );
}
