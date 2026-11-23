import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { Text, View } from "react-native";
import type { WeightResponse } from "@et/core/api-types";
import { kgToDisplay, weightUnit } from "@et/core/domain";
import { weightChange } from "@et/core/weight";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { useTheme } from "@/theme";
import { Body, Button, ErrorText, Screen, Title } from "@/ui";
import { Empty, List, ListRow } from "@/ui/list";

/**
 * Bodyweight: the 7-day average, latest weigh-in and 30/90-day change, then every weigh-in. The
 * trend chart comes with the native chart library.
 */
export function Weight({ header }: { header?: boolean }) {
  const t = useTheme();
  const me = useMe();
  const q = useQuery({ queryKey: ["weight"], queryFn: () => api<WeightResponse>("/weight") });
  const units = me.data?.profile.units;
  const d = q.data;
  const u = units ? weightUnit(units) : "";
  const show = (kg: number) => (units ? Math.round(kgToDisplay(kg, units) * 10) / 10 : 0);
  const signed = (kg: number) => `${show(kg) > 0 ? "+" : ""}${show(kg)} ${u}`;
  const latest = d?.series[d.series.length - 1];
  const stats = d && latest
    ? [
        { label: "7-day average", value: `${show(latest.avgKg)} ${u}` },
        { label: "Latest weigh-in", value: `${show(latest.kg)} ${u}`, sub: format(parseISO(latest.date), "MMM d") },
        ...[30, 90].map((days) => {
          const c = weightChange(d.series, days, d.today);
          return { label: `${days}-day change`, value: c ? signed(c.deltaKg) : "—", sub: c ? `from ${show(c.fromKg)} ${u}` : "Not enough history yet" };
        }),
      ]
    : [];

  return (
    <Screen header={header} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Daily weigh-ins and the 7-day average, which smooths out day-to-day swings.">Weight</Title>
      <ErrorText>{q.error?.message}</ErrorText>
      {d && !d.trackWeight ? (
        <Empty>
          <Body muted style={{ textAlign: "center" }}>Weight tracking is off.</Body>
          <Button title="Turn it on in Settings" variant="link" onPress={() => router.navigate("/settings")} />
        </Empty>
      ) : d && !d.series.length ? (
        <Empty>No weigh-ins yet. Log one from any day on the calendar.</Empty>
      ) : d && units ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, width: "48%", flexGrow: 1 }}>
                <Text style={{ color: t.muted, fontSize: 12 }}>{s.label}</Text>
                <Text style={{ color: t.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{s.value}</Text>
                {s.sub ? <Text style={{ color: t.muted, fontSize: 12 }}>{s.sub}</Text> : null}
              </View>
            ))}
          </View>
          <List title="Weigh-ins">
            {[...d.series].reverse().map((p, i) => (
              <ListRow
                key={p.date}
                first={i === 0}
                title={format(parseISO(p.date), "EEE, MMM d, yyyy")}
                value={`${show(p.kg)} ${u}`}
                detail={`avg ${show(p.avgKg)}`}
                onPress={() => router.push({ pathname: "/day/[date]", params: { date: p.date } })}
              />
            ))}
          </List>
        </>
      ) : null}
    </Screen>
  );
}
