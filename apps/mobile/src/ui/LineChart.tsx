import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useTheme } from "@/theme";

export interface ChartPoint {
  /** yyyy-MM-dd */
  date: string;
  y: number;
  /** Drawn as a filled dot (a new PB). */
  mark?: boolean;
}

const PAD = { top: 10, right: 8, bottom: 22, left: 56 };

/**
 * A line over time with dots, plus optional loose dots (daily weigh-ins under their average).
 * `invert`: lower values draw higher, so up is always better (race times). Dates are spaced by
 * time, not by count, so a long gap looks like one.
 */
export function LineChart({
  line,
  dots = [],
  invert,
  formatY,
  height = 200,
  label,
  lineDots = true,
}: {
  line: ChartPoint[];
  dots?: ChartPoint[];
  invert?: boolean;
  formatY: (v: number) => string;
  height?: number;
  /** Read out by screen readers instead of the drawing. */
  label: string;
  /** A dot on every point of the line (off for a dense average line). */
  lineDots?: boolean;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const all = [...line, ...dots];
  if (all.length < 2) return null;

  const times = all.map((p) => parseISO(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const ys = all.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const padY = (hi - lo) * 0.08;
  lo -= padY;
  hi += padY;
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + (t1 === t0 ? w / 2 : ((parseISO(d).getTime() - t0) / (t1 - t0)) * w);
  const y = (v: number) => PAD.top + (invert ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo)) * h;
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height, marginTop: 8 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {ticks.map((v) => (
              <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={t.border} strokeWidth={1} />
            ))}
            {dots.map((p, i) => (
              <Circle key={`d${i}`} cx={x(p.date)} cy={y(p.y)} r={2.5} fill={t.muted} opacity={0.5} />
            ))}
            {line.length > 1 && (
              <Polyline points={line.map((p) => `${x(p.date)},${y(p.y)}`).join(" ")} fill="none" stroke={t.accent} strokeWidth={2} strokeLinejoin="round" />
            )}
            {line.filter((p) => lineDots || p.mark).map((p, i) => (
              <Circle key={`l${i}`} cx={x(p.date)} cy={y(p.y)} r={p.mark ? 4.5 : 3} fill={p.mark ? t.accent : t.surface} stroke={t.accent} strokeWidth={2} />
            ))}
          </Svg>
          {ticks.map((v) => (
            <Text key={v} style={{ position: "absolute", left: 0, width: PAD.left - 6, top: y(v) - 8, textAlign: "right", fontSize: 11, color: t.muted, fontVariant: ["tabular-nums"] }}>
              {formatY(v)}
            </Text>
          ))}
          <Text style={{ position: "absolute", left: PAD.left, bottom: 0, fontSize: 11, color: t.muted }}>{format(t0, "MMM d, yyyy")}</Text>
          <Text style={{ position: "absolute", right: PAD.right, bottom: 0, fontSize: 11, color: t.muted }}>{format(t1, "MMM d, yyyy")}</Text>
        </>
      )}
    </View>
  );
}
