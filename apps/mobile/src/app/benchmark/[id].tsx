import { format, parseISO } from "date-fns";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { betterLabel, CATEGORY_LABEL, METRIC_LABEL } from "@et/core/benchmarks/catalog";
import { formatResult, markRunningPBs, personalBest, resultScore } from "@et/core/domain";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useBenchmarks, useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { ResultForm } from "@/screens/benchmarks/ResultForm";
import { Sparkline } from "@/screens/benchmarks/Sparkline";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText, Screen } from "@/ui";
import { ask } from "@/ui/confirm";
import { SectionTitle } from "@/ui/form";
import { List, ListRow } from "@/ui/list";

/** One benchmark: the PB, its history, recording a result, and editing or deleting results. */
export default function BenchmarkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signedIn = useSession().status === "signedIn";
  const me = useMe(signedIn);
  const q = useBenchmarks();
  const t = useTheme();
  const act = useAction([["benchmarks"], ["calendar"], ["leaderboards"]]);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (!signedIn) return <Redirect href="/sign-in" />;
  const def = q.data?.benchmarks.find((b) => b.id === id);
  const units = me.data?.profile.units;
  const today = me.data?.today ?? format(new Date(), "yyyy-MM-dd");
  const results = (q.data?.results ?? []).filter((r) => r.benchmarkId === id).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  return (
    <>
      <Stack.Screen options={{ title: def?.name ?? "" }} />
      <Screen header onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
        <ErrorText>{act.error ?? q.error?.message}</ErrorText>
        {q.data && !def && <Body muted>This benchmark was deleted.</Body>}
        {def && units && (
          <>
            {(() => {
              const pb = personalBest(def, results);
              const marked = markRunningPBs(def, results);
              return (
                <>
                  <Body muted style={{ marginBottom: 12 }}>
                    {CATEGORY_LABEL[def.category]} · {METRIC_LABEL[def.metricKind]} · {betterLabel(def.metricKind, def.direction)}
                  </Body>
                  <Card>
                    {pb ? (
                      <>
                        <Text style={{ color: t.text, fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                          <Text style={{ color: t.pb }}>★ </Text>
                          {formatResult(def, pb, units)}
                        </Text>
                        <Body muted>
                          Personal best · {format(parseISO(pb.date), "MMMM d, yyyy")}
                          {def.metricKind === "weight_reps" ? ` · ${formatResult(def, { value: resultScore(def, pb), reps: 1 }, units)} e1RM` : ""}
                        </Body>
                        <Sparkline def={def} results={results} height={56} />
                      </>
                    ) : (
                      <Body muted>Record your first result to set a baseline.</Body>
                    )}
                  </Card>

                  <Card>
                    <SectionTitle>Record a result</SectionTitle>
                    <ResultForm def={def} units={units} today={today} />
                  </Card>

                  <List title="Results">
                    {marked.length === 0 ? (
                      <Body muted style={{ textAlign: "center", padding: 20 }}>No results yet</Body>
                    ) : (
                      [...marked].reverse().map((r, i) =>
                        editingId === r.id ? (
                          <View key={r.id} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderColor: t.border }}>
                            <ResultForm def={def} units={units} today={today} editing={r} onDone={() => setEditingId(null)} />
                          </View>
                        ) : (
                          <ListRow
                            key={r.id}
                            first={i === 0}
                            title={`${formatResult(def, r, units)}${r.id === pb?.id ? "  ★" : ""}`}
                            subtitle={`${format(parseISO(r.date), "MMM d, yyyy")}${r.isPb ? " · new PB" : ""}${r.notes ? ` · ${r.notes}` : ""}`}
                            right={
                              <View>
                                <Button title="Edit" variant="link" onPress={() => setEditingId(r.id)} />
                                <Button
                                  title="Delete"
                                  variant="link"
                                  onPress={async () => {
                                    if (await ask("Delete this result?", formatResult(def, r, units), "Delete", true))
                                      void act.run(() => api(`/benchmarks/${def.id}/results/${r.date}/${r.id}`, { method: "DELETE" }));
                                  }}
                                />
                              </View>
                            }
                          />
                        ),
                      )
                    )}
                  </List>

                  <Button
                    title="Delete benchmark"
                    variant="danger"
                    onPress={async () => {
                      if (!(await ask(`Delete "${def.name}"?`, `This deletes it and all ${results.length} results.`, "Delete", true))) return;
                      if (await act.run(() => api(`/benchmarks/${def.id}`, { method: "DELETE" }))) router.back();
                    }}
                  />
                </>
              );
            })()}
          </>
        )}
      </Screen>
    </>
  );
}
