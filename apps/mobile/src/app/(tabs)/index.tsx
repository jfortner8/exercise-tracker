import { addDays, format, parseISO } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ymd } from "@et/core/domain";
import { calendarDays, stepAnchor, useCalendar, useCalendarWrite, type CalendarView } from "@/api/calendar";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { CalendarGrid, useDays } from "@/screens/calendar/Calendar";
import { setMoving, useMoving } from "@/screens/calendar/moving";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText, Screen } from "@/ui";
import { choose } from "@/ui/confirm";
import { DateField, SectionTitle, SmallField } from "@/ui/form";
import { Notice } from "@/ui/list";

/** The training calendar: a month of tiles or a week of rows. Tap a day to open it. */
export default function CalendarScreen() {
  const t = useTheme();
  const me = useMe();
  const today = me.data?.today ?? "";
  const profile = me.data?.profile;
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState<string | null>(null);
  const at = anchor ?? today;
  const range = at && profile ? calendarDays(at, view, profile.weekStartsOn) : undefined;
  const cal = useCalendar(range?.from, range?.to);
  const byDay = useDays(cal.data, range?.days ?? [], today);

  const moving = useMoving();
  const write = useCalendarWrite((f: () => Promise<unknown>) => f());
  const [copying, setCopying] = useState(false);
  const planned = (d: string) => (byDay.get(d)?.workouts ?? []).filter((w) => w.status === "planned");

  /** Long press: one planned workout starts moving; with several, the day opens to pick one. */
  function startMove(d: string) {
    const ws = planned(d);
    if (ws.length === 1) setMoving(ws[0]);
    else if (ws.length > 1) router.push({ pathname: "/day/[date]", params: { date: d } });
  }

  /** While moving, a tap says where it goes. A day with its own plan asks: swap, or add to it. */
  async function tapDay(d: string) {
    if (!moving) return router.push({ pathname: "/day/[date]", params: { date: d } });
    const w = moving;
    if (d === w.date) return setMoving(null);
    const targets = planned(d);
    let swap = false;
    if (targets.length) {
      const c = await choose(
        `${format(parseISO(d), "EEE, MMM d")} has ${targets.map((x) => x.title).join(", ")} planned`,
        `Swap so ${targets.length === 1 ? "it moves" : "they move"} to ${format(parseISO(w.date), "EEE, MMM d")}, or add ${w.title} to that day?`,
        ["Swap days", "Add to that day"],
      );
      if (c == null) return;
      swap = c === 0;
    }
    setMoving(null);
    write.mutate(() => api(`/workouts/${w.date}/${w.id}/${swap ? "swap" : "move"}`, { body: { toDate: d } }));
  }

  const title = !at ? " " : view === "month" ? format(parseISO(at), "MMMM yyyy") : `Week of ${format(parseISO(range!.from), "MMM d")}`;
  const refresh = () => {
    void me.refetch();
    void cal.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={cal.isRefetching}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
          {title}
        </Text>
        <Segmented value={view} onChange={setView} />
      </View>
      <View style={styles.nav}>
        <NavButton label="‹" a11y="Previous" onPress={() => setAnchor(stepAnchor(at, view, -1))} />
        <NavButton label="Today" onPress={() => setAnchor(null)} />
        <NavButton label="›" a11y="Next" onPress={() => setAnchor(stepAnchor(at, view, 1))} />
      </View>
      <ErrorText>{(write.error ?? me.error ?? cal.error)?.message}</ErrorText>
      {moving ? (
        <Notice>
          <Body>Moving {moving.title}. Tap the day it goes to.</Body>
          <Button title="Cancel" variant="link" onPress={() => setMoving(null)} />
        </Notice>
      ) : null}
      {profile && range && (
        <CalendarGrid
          view={view}
          days={range.days}
          monthIndex={parseISO(at).getMonth()}
          byDay={byDay}
          profile={profile}
          today={today}
          startDate={cal.data?.startDate ?? null}
          onOpen={(date) => void tapDay(date)}
          onLongPress={startMove}
          movingFrom={moving?.date}
        />
      )}
      {profile && range && !moving ? (
        <Body muted style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>Long-press a day to move its planned workout.</Body>
      ) : null}
      {view === "week" && range && profile ? (
        copying ? (
          <CopyWeek from={range.from} count={range.days.reduce((n, d) => n + (byDay.get(d)?.workouts.length ?? 0), 0)} onClose={() => setCopying(false)} />
        ) : (
          <Button title="Copy this week…" variant="secondary" onPress={() => setCopying(true)} />
        )
      ) : null}
    </Screen>
  );
}

/** Copies a week's workouts as planned ones onto later weeks, on the same weekdays. */
function CopyWeek({ from, count, onClose }: { from: string; count: number; onClose: () => void }) {
  const [to, setTo] = useState(ymd(addDays(parseISO(from), 7)));
  const [times, setTimes] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);
  const write = useCalendarWrite((f: () => Promise<{ copied: number }>) => f());
  const n = Math.max(1, Math.min(52, Number(times) || 1));
  return (
    <Card>
      <SectionTitle>Copy week</SectionTitle>
      <Body muted style={{ marginBottom: 10 }}>
        Week of {format(parseISO(from), "MMM d")} · {count} workout{count === 1 ? "" : "s"}
      </Body>
      {count === 0 ? (
        <Body muted>This week has no workouts to copy yet.</Body>
      ) : (
        <>
          <Body muted style={{ fontSize: 14, marginBottom: 10 }}>Copies are added as planned workouts on the same weekdays. Results and notes aren&apos;t copied.</Body>
          <DateField label="Starting the week of" value={to} onChange={setTo} min={ymd(addDays(parseISO(from), 1))} />
          <SmallField label="Repeat for (weeks in a row)" value={times} onChangeText={setTimes} keyboardType="number-pad" />
          <ErrorText>{write.error?.message}</ErrorText>
          {msg ? <Body style={{ marginBottom: 6 }}>{msg}</Body> : null}
          <Button
            title={`Copy ${count * n} workout${count * n === 1 ? "" : "s"}`}
            loading={write.isPending}
            onPress={() =>
              write.mutate(() => api<{ copied: number }>("/weeks/copy", { body: { fromStart: from, toStart: to, times: n } }), {
                onSuccess: (r) => {
                  setMsg(`Added ${(r as { copied: number }).copied} planned workouts.`);
                  setTimeout(onClose, 900);
                },
              })
            }
          />
        </>
      )}
      <Button title="Close" variant="link" onPress={onClose} />
    </Card>
  );
}

function Segmented({ value, onChange }: { value: CalendarView; onChange: (v: CalendarView) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.border, backgroundColor: t.surface }]}>
      {(["month", "week"] as const).map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: v === value }}
          onPress={() => onChange(v)}
          style={[styles.segment, v === value && { backgroundColor: t.surface2 }]}
        >
          <Text style={{ color: v === value ? t.text : t.muted, fontWeight: "600", fontSize: 14 }}>{v === "month" ? "Month" : "Week"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NavButton({ label, a11y, onPress }: { label: string; a11y?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, { borderColor: t.border, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: t.text, fontSize: label.length === 1 ? 22 : 14, fontWeight: "600", lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4, flexShrink: 1 },
  nav: { flexDirection: "row", gap: 8, marginBottom: 12 },
  navButton: { height: 36, minWidth: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 2 },
  segment: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
});
