import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Text, View } from "react-native";
import type { SportsResponse } from "@et/core/api-types";
import { api } from "@/api/client";
import { useTheme } from "@/theme";
import { Body, Card, ErrorText, Screen, Title } from "@/ui";
import { Empty } from "@/ui/list";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Completed sessions for every sport played, as on the website's Sports page. */
export function Sports({ header }: { header?: boolean }) {
  const t = useTheme();
  const q = useQuery({ queryKey: ["sports"], queryFn: () => api<SportsResponse>("/sports") });
  return (
    <Screen header={header} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Completed games, matches, bouts and practices for every sport you've played.">Sports</Title>
      <ErrorText>{q.error?.message}</ErrorText>
      {q.data && !q.data.tallies.length && <Empty>No completed sport sessions yet. Log a workout as Sport, pick the sport, and mark it done.</Empty>}
      {q.data?.tallies.map((s) => (
        <Card key={s.key}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 30 }} accessibilityElementsHidden>
              {s.emoji}
            </Text>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "700" }}>{s.label}</Body>
              <Body muted style={{ fontSize: 13 }}>
                {plural(s.total, "session", "sessions")} · {s.thisYear} this year · last {format(parseISO(s.lastDate), "MMM d, yyyy")}
              </Body>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {[...s.sessions.map((x) => ({ label: x.plural.charAt(0).toUpperCase() + x.plural.slice(1), count: x.count })), ...(s.unspecified > 0 ? [{ label: "Unspecified", count: s.unspecified }] : [])].map((x) => (
              <View key={x.label} style={{ backgroundColor: t.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: "47%", flexGrow: 1 }}>
                <Text style={{ color: t.muted, fontSize: 12 }}>{x.label}</Text>
                <Text style={{ color: t.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{x.count}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
