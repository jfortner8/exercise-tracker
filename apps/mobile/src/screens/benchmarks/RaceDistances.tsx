import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { RaceDistancesResponse } from "@et/core/api-types";
import { distanceUnit, metersToDisplay } from "@et/core/domain";
import type { Units } from "@et/core/types";
import { api } from "@/api/client";
import { useTheme } from "@/theme";
import { Body } from "@/ui";
import { SectionTitle } from "@/ui/form";

export const useRaceDistances = () =>
  useQuery({ queryKey: ["race-distances"], queryFn: () => api<RaceDistancesResponse>("/race-distances") });

const times = (n: number) => `${n} ${n === 1 ? "time" : "times"}`;

/**
 * How many times each common race distance was covered, per sport: "10K · 6 times". Each workout
 * counts once, for the longest distance it reached. Tap a tile for the list. Hidden until there's one.
 */
export function RaceDistances({ units }: { units: Units }) {
  const t = useTheme();
  const q = useRaceDistances();
  const [open, setOpen] = useState<string | null>(null);
  const d = q.data;
  if (!d?.sports.length) return null;
  const dist = (m: number) => `${Math.round(metersToDisplay(m, units) * 10) / 10} ${distanceUnit(units)}`;

  return (
    <View style={{ marginBottom: 8 }}>
      <SectionTitle>Race distances</SectionTitle>
      <Body muted style={{ fontSize: 13, marginBottom: 8 }}>Each workout counts once, for the longest race distance it reached: a 12 km run is a 10K.</Body>
      {d.sports.map((s) => {
        const chosen = s.distances.find((x) => open === `${s.sport}:${x.key}`);
        return (
          <View key={s.sport} style={{ marginBottom: 12 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "600", marginBottom: 6 }}>{s.label}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {s.distances.map((x) => {
                const key = `${s.sport}:${x.key}`;
                const on = open === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: on }}
                    accessibilityLabel={`${s.label} ${x.label}: ${times(x.total)}, ${x.thisYear} in ${d.year}`}
                    onPress={() => setOpen(on ? null : key)}
                    style={{
                      width: "31%",
                      flexGrow: 1,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      borderColor: on ? t.accent : t.border,
                      backgroundColor: on ? t.surface2 : t.surface,
                    }}
                  >
                    <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600" }}>{x.label}</Text>
                    <Text style={{ color: t.text, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{times(x.total)}</Text>
                    <Text style={{ color: t.muted, fontSize: 12 }}>
                      {x.thisYear} in {d.year}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {chosen && (
              <View style={{ borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 12, marginTop: 8, paddingVertical: 4 }}>
                {chosen.workouts.map((w) => (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/day/[date]", params: { date: w.date } })}
                    style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, flexShrink: 1 }}>
                      <Text style={{ color: t.muted }}>{format(parseISO(w.date), "MMM d, yyyy")}</Text> {w.title}
                    </Text>
                    <Text style={{ color: t.text, fontSize: 14, fontVariant: ["tabular-nums"] }}>{dist(w.meters)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
