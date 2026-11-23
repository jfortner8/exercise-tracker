import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { IdResponse } from "@et/core/api-types";
import { BENCHMARK_CATALOG, CATEGORY_LABEL, METRIC_LABEL } from "@et/core/benchmarks/catalog";
import { defaultDirection, formatResult, personalBest } from "@et/core/domain";
import { BENCHMARK_CATEGORIES, METRIC_KINDS, type BenchmarkCategory, type BenchmarkDef, type BenchmarkResult, type MetricKind, type Units } from "@et/core/types";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useBenchmarks, useMe } from "@/api/queries";
import { Sparkline } from "@/screens/benchmarks/Sparkline";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/ui";
import { Chips, SectionTitle } from "@/ui/form";
import { Empty } from "@/ui/list";

/** Benchmarks you track, with each PB; suggestions to start tracking; and your own. */
export default function PBs() {
  const units = useMe().data?.profile.units;
  const q = useBenchmarks();
  const [adding, setAdding] = useState(false);
  const act = useAction([["benchmarks"]]);
  const byBm = useMemo(() => {
    const m = new Map<string, BenchmarkResult[]>();
    for (const r of q.data?.results ?? []) m.set(r.benchmarkId, [...(m.get(r.benchmarkId) ?? []), r]);
    for (const l of m.values()) l.sort((a, b) => a.date.localeCompare(b.date));
    return m;
  }, [q.data]);
  const benchmarks = q.data?.benchmarks ?? [];
  const tracked = new Set(benchmarks.map((b) => b.catalogKey).filter(Boolean));
  const available = BENCHMARK_CATALOG.filter((c) => !tracked.has(c.key));

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Benchmarks you test now and then, and your personal bests.">PBs</Title>
      <ErrorText>{act.error ?? q.error?.message}</ErrorText>
      {adding ? <CreateBenchmark onClose={() => setAdding(false)} /> : <Button title="+ Add benchmark" onPress={() => setAdding(true)} />}
      <View style={{ height: 14 }} />
      {q.data && !benchmarks.length && <Empty>No benchmarks yet. Pick a few suggestions below, or create your own.</Empty>}
      {units &&
        BENCHMARK_CATEGORIES.map((c) => {
          const items = benchmarks.filter((b) => b.category === c).sort((a, b) => a.name.localeCompare(b.name));
          return items.length ? (
            <View key={c}>
              <SectionTitle>{CATEGORY_LABEL[c]}</SectionTitle>
              {items.map((b) => (
                <BenchmarkCard key={b.id} def={b} results={byBm.get(b.id) ?? []} units={units} />
              ))}
            </View>
          ) : null;
        })}
      {q.data && available.length > 0 && (
        <>
          <SectionTitle>Suggestions</SectionTitle>
          <Body muted style={{ marginBottom: 8 }}>Tap to start tracking.</Body>
          {[...new Set(available.map((a) => a.category))].map((c) => (
            <Chips
              key={c}
              label={CATEGORY_LABEL[c]}
              options={available.filter((a) => a.category === c).map((a) => ({ value: a.key, label: `+ ${a.name}` }))}
              value=""
              onChange={(key) => key && void act.run(() => api<IdResponse>(`/benchmarks/catalog/${key}`, { body: {} }))}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

function BenchmarkCard({ def, results, units }: { def: BenchmarkDef; results: BenchmarkResult[]; units: Units }) {
  const t = useTheme();
  const pb = personalBest(def, results);
  const last = results.at(-1);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/benchmark/[id]", params: { id: def.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Body style={{ fontWeight: "600" }}>{def.name}</Body>
          {pb ? <Text style={{ color: t.pb }}>★</Text> : <Text style={{ color: t.muted, fontSize: 18 }}>›</Text>}
        </View>
        {pb ? (
          <>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"], marginTop: 4 }}>{formatResult(def, pb, units)}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              PB · {format(parseISO(pb.date), "MMM d, yyyy")}
              {last && last.id !== pb.id ? ` · last ${formatResult(def, last, units)}` : ""}
            </Text>
            <Sparkline def={def} results={results} />
          </>
        ) : (
          <Body muted style={{ fontSize: 14, marginTop: 4 }}>No results yet. Record one from the calendar or here.</Body>
        )}
      </Card>
    </Pressable>
  );
}

function CreateBenchmark({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BenchmarkCategory>("custom");
  const [metricKind, setMetricKind] = useState<MetricKind>("time");
  const [direction, setDirection] = useState(defaultDirection("time"));
  const [unit, setUnit] = useState("");
  const act = useAction([["benchmarks"]]);
  return (
    <Card>
      <SectionTitle>New benchmark</SectionTitle>
      <Body muted style={{ marginBottom: 10 }}>If you can measure it, you can track it.</Body>
      <Field label="Name" value={name} onChangeText={setName} placeholder="200 m IM, Farmer carry, Box jump…" maxLength={120} />
      <Chips label="Category" options={BENCHMARK_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} value={category} onChange={(c) => c && setCategory(c)} />
      <Chips
        label="Measured as"
        options={METRIC_KINDS.map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
        value={metricKind}
        onChange={(k) => {
          if (!k) return;
          setMetricKind(k);
          setDirection(defaultDirection(k));
        }}
      />
      <Chips label="Better is" options={[{ value: "lower" as const, label: "Lower" }, { value: "higher" as const, label: "Higher" }]} value={direction} onChange={(d) => d && setDirection(d)} />
      {metricKind === "number" && <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="in, bpm, watts…" maxLength={20} />}
      <ErrorText>{act.error}</ErrorText>
      <Button
        title="Create"
        disabled={!name.trim()}
        loading={act.pending}
        onPress={async () => {
          const r = await act.run(() => api<IdResponse>("/benchmarks", { body: { name, category, metricKind, direction, unit: unit || undefined } }));
          if (r) {
            onClose();
            router.push({ pathname: "/benchmark/[id]", params: { id: r.id } });
          }
        }}
      />
      <Button title="Cancel" variant="link" onPress={onClose} />
    </Card>
  );
}
