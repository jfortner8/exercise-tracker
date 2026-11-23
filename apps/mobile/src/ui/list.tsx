import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

/** A soft box for a heads-up ("You're hidden from every leaderboard"). */
export function Notice({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.notice, { borderColor: t.border, backgroundColor: t.surface2 }]}>
      {typeof children === "string" ? <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{children}</Text> : children}
    </View>
  );
}

/** A dashed box for an empty list. */
export function Empty({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { borderColor: t.border }]}>
      {typeof children === "string" ? <Text style={{ color: t.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>{children}</Text> : children}
    </View>
  );
}

/** A bordered list; put ListRows inside. Optional header text and a footnote. */
export function List({ title, subtitle, children, footer }: { title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.list, { borderColor: t.border, backgroundColor: t.surface }]}>
      {title ? (
        <View style={[styles.listHead, { borderColor: t.border }]}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
      {footer ? (
        <View style={[styles.listFoot, { borderColor: t.border }]}>
          {typeof footer === "string" ? <Text style={{ color: t.muted, fontSize: 12 }}>{footer}</Text> : footer}
        </View>
      ) : null}
    </View>
  );
}

/** One row: an optional rank, a name with an optional tag, and a value with a line under it. */
export function ListRow({
  rank,
  title,
  tag,
  subtitle,
  value,
  detail,
  highlight,
  onPress,
  first,
  right,
}: {
  rank?: number;
  title: string;
  tag?: string;
  subtitle?: string;
  value?: string;
  detail?: string;
  highlight?: boolean;
  onPress?: () => void;
  first?: boolean;
  right?: ReactNode;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border }, highlight && { backgroundColor: t.surface2 }]}>
      {rank != null ? <Text style={[styles.rank, { color: t.muted }]}>{rank}</Text> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>
          {title}
          {tag ? <Text style={{ color: t.accentInk, fontSize: 12, fontWeight: "500" }}>{`  ${tag}`}</Text> : null}
        </Text>
        {subtitle ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {value || detail ? (
        <View style={{ alignItems: "flex-end" }}>
          {value ? <Text style={{ color: t.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text> : null}
          {detail ? <Text style={{ color: t.muted, fontSize: 12, fontVariant: ["tabular-nums"] }}>{detail}</Text> : null}
        </View>
      ) : null}
      {right}
      {onPress ? <Text style={{ color: t.muted, fontSize: 18 }}>›</Text> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A row of chips that scrolls sideways (groups, benchmarks). */
export function ChipScroller<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={[styles.cap, { color: t.muted }]}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.surface2 : t.surface }]}
            >
              <Text style={{ color: on ? t.accentInk : t.muted, fontWeight: "600", fontSize: 14 }}>
                {o.label}
                {o.count != null ? <Text style={{ opacity: 0.6 }}>{`  ${o.count}`}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 28, marginBottom: 14, alignItems: "center", gap: 8 },
  list: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  listHead: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  listFoot: { paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  rank: { width: 22, textAlign: "right", fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  cap: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
});
