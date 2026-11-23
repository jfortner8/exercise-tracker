import { format, parseISO } from "date-fns";
import { View } from "react-native";
import type { Workout } from "@et/core/types";
import { useDayWorkouts, useMe } from "@/api/queries";
import { useTheme } from "@/theme";
import { Body, Card, ErrorText, Screen, Title } from "@/ui";

const STATUS: Record<string, string> = {
  planned: "Planned",
  completed: "Done",
  partial: "Partly done",
  missed: "Missed",
  skipped: "Skipped",
};

/**
 * Today's workouts. The month and week calendar replaces this next; for now it shows the app is
 * signed in and talking to the API.
 */
export default function Today() {
  const me = useMe();
  const today = me.data?.today;
  const day = useDayWorkouts(today);
  const refresh = () => {
    void me.refetch();
    void day.refetch();
  };
  const name = me.data?.profile.displayName;

  return (
    <Screen onRefresh={refresh} refreshing={me.isRefetching || day.isRefetching}>
      <Title subtitle={today ? format(parseISO(today), "EEEE, MMMM d") : " "}>{name ? `Hi, ${name}` : "Today"}</Title>
      <ErrorText>{(me.error ?? day.error)?.message}</ErrorText>
      {day.data &&
        (day.data.workouts.length === 0 ? (
          <Card>
            <Body muted>Nothing planned today.</Body>
          </Card>
        ) : (
          day.data.workouts.map((w) => <WorkoutRow key={w.id} w={w} />)
        ))}
    </Screen>
  );
}

function WorkoutRow({ w }: { w: Workout }) {
  const t = useTheme();
  const done = w.status === "completed" || w.status === "partial";
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Body style={{ fontWeight: "600", flexShrink: 1 }}>{w.title || w.type}</Body>
        <Body style={{ color: done ? t.done : w.status === "planned" ? t.plannedFg : t.missed }}>{STATUS[w.status] ?? w.status}</Body>
      </View>
      {w.startTime ? <Body muted>{w.startTime}</Body> : null}
    </Card>
  );
}
