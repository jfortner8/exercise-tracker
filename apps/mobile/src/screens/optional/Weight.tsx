import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import type { WeightResponse } from "@et/core/api-types";
import { kgToDisplay, weightUnit, ymd } from "@et/core/domain";
import { weightChange } from "@et/core/weight";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { useTheme } from "@/theme";
import { Body, Button, ErrorText, Screen, Title } from "@/ui";
import { Chips } from "@/ui/form";
import { LineChart } from "@/ui/LineChart";
import { Empty, List, ListRow } from "@/ui/list";

const RANGES = [
  { key: "1m", label: "1 mo", months: 1 },
  { key: "3m", label: "3 mo", months: 3 },
  { key: "6m", label: "6 mo", months: 6 },
  { key: "1y", label: "1 yr", months: 12 },
  { key: "all", label: "All", months: 0 },
] as const;
type Range = (typeof RANGES)[number]["key"];

/** Bodyweight: the 7-day average, latest weigh-in, 30/90-day change, the trend, and every weigh-in. */
export function Weight({ header }: { header?: boolean }) {
  const t = useTheme();
  const me = useMe();
  const [range, setRange] = useState<Range>("3m");
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
          <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <Chips options={RANGES.map((r) => ({ value: r.key, label: r.label }))} value={range} onChange={(v) => v && setRange(v)} />
            {(() => {
              const months = RANGES.find((r) => r.key === range)!.months;
              const since = months ? ymd(subMonths(parseISO(d.today), months)) : "";
              const shown = d.series.filter((p) => p.date >= since);
              return shown.length >= 2 ? (
                <>
                  <LineChart
                    line={shown.map((p) => ({ date: p.date, y: show(p.avgKg) }))}
                    dots={shown.map((p) => ({ date: p.date, y: show(p.kg) }))}
                    formatY={(v) => (Math.round(v * 10) / 10).toFixed(1)}
                    lineDots={false}
                    label={`Weight trend: 7-day average from ${show(shown[0].avgKg)} to ${show(shown[shown.length - 1].avgKg)} ${u}`}
                  />
                  <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Dots are weigh-ins; the line is the 7-day average.</Text>
                </>
              ) : (
                <Text style={{ color: t.muted, fontSize: 13 }}>Not enough weigh-ins in this range for a trend yet.</Text>
              );
            })()}
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
