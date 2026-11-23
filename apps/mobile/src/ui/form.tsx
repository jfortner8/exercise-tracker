import { addDays, format, parseISO } from "date-fns";
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
  stepBtn: { height: 44, minWidth: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 16 },
});

/**
 * A date as yyyy-MM-dd, stepped a day at a time. `optional`: it can be left empty ("Not set").
 * One place to swap in the phone's native date picker.
 */
export function DateField({
  label,
  value,
  onChange,
  optional,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  min?: string;
}) {
  const t = useTheme();
  const step = (n: number) => {
    const next = format(addDays(parseISO(value || min || format(new Date(), "yyyy-MM-dd")), n), "yyyy-MM-dd");
    onChange(min && next < min ? min : next);
  };
  const btn = (title: string, onPress: () => void, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={[styles.stepBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {optional && !value ? (
        <Pressable accessibilityRole="button" onPress={() => onChange(min && min > format(new Date(), "yyyy-MM-dd") ? min : format(new Date(), "yyyy-MM-dd"))} style={[styles.stepBtn, { borderColor: t.border, backgroundColor: t.surface, alignSelf: "flex-start", paddingHorizontal: 14 }]}>
          <Text style={{ color: t.muted, fontSize: 15 }}>Not set · tap to set</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {btn("‹", () => step(-1), "Day before")}
          <Text style={{ flex: 1, textAlign: "center", color: t.text, fontSize: 16, fontWeight: "600" }}>{format(parseISO(value), "EEE, MMM d, yyyy")}</Text>
          {btn("›", () => step(1), "Day after")}
          {optional ? btn("✕", () => onChange(""), `Clear ${label}`) : null}
        </View>
      )}
    </View>
  );
}
