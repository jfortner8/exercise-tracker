import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme";

/** One choice out of several, as a wrap of chips. Tapping the chosen one again clears it when `clearable`. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  clearable,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | "" | undefined;
  onChange: (v: T | "") => void;
  clearable?: boolean;
  label?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={[styles.label, { color: t.text }]}>{label}</Text> : null}
      <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on && clearable ? "" : o.value)}
              style={[styles.chip, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.surface2 : t.surface }]}
            >
              <Text style={{ color: on ? t.accentInk : t.muted, fontWeight: "600", fontSize: 14 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Several choices at once (weekdays). */
export function MultiChips({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { marginBottom: 12 }]}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            style={[styles.chip, { minWidth: 44, alignItems: "center", borderColor: on ? t.accent : t.border, backgroundColor: on ? t.surface2 : t.surface }]}
          >
            <Text style={{ color: on ? t.accentInk : t.muted, fontWeight: "600" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent }} accessibilityLabel={label} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/** A compact labelled input for grids (sets, reps, minutes). `hint` shows under it, red when `bad`. */
export function SmallField({ label, hint, bad, ...input }: TextInputProps & { label: string; hint?: string; bad?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, marginBottom: 10 }}>
      <Text style={[styles.smallLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: bad ? t.danger : t.border }]}
        {...input}
      />
      {hint ? <Text style={{ color: bad ? t.danger : t.muted, fontSize: 12, marginTop: 3 }}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  smallLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, marginBottom: 4 },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 8 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 16 },
});
