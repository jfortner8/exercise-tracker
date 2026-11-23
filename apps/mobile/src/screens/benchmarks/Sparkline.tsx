import { View } from "react-native";
import { resultScore } from "@et/core/domain";
import type { BenchmarkDef, BenchmarkResult } from "@et/core/types";
import { useTheme } from "@/theme";

/**
 * A benchmark's results as small bars, oldest first, taller is always better. Plain views, so it
 * needs no chart library; the detail screen gets the full chart.
 */
export function Sparkline({ def, results, height = 32 }: { def: BenchmarkDef; results: BenchmarkResult[]; height?: number }) {
  const t = useTheme();
  if (results.length < 2) return null;
  const ys = results.slice(-30).map((r) => resultScore(def, r));
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const better = (y: number) => (def.direction === "lower" ? 1 - (y - min) / span : (y - min) / span);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height, marginTop: 10 }}>
      {ys.map((y, i) => (
        <View key={i} style={{ flex: 1, maxWidth: 12, height: `${15 + better(y) * 85}%`, borderRadius: 2, backgroundColor: t.accent, opacity: i === ys.length - 1 ? 1 : 0.55 }} />
      ))}
    </View>
  );
}
