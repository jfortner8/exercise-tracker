import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { calendarDays, stepAnchor, useCalendar, type CalendarView } from "@/api/calendar";
import { useMe } from "@/api/queries";
import { CalendarGrid, useDays } from "@/screens/calendar/Calendar";
import { useTheme } from "@/theme";
import { ErrorText, Screen } from "@/ui";

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
      <ErrorText>{(me.error ?? cal.error)?.message}</ErrorText>
      {profile && range && (
        <CalendarGrid
          view={view}
          days={range.days}
          monthIndex={parseISO(at).getMonth()}
          byDay={byDay}
          profile={profile}
          today={today}
          startDate={cal.data?.startDate ?? null}
          onOpen={(date) => router.push({ pathname: "/day/[date]", params: { date } })}
        />
      )}
    </Screen>
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
