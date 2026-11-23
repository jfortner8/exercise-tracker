import { addDays, format, parseISO } from "date-fns";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme";

/*
 * The web build (development only) has no native pickers: dates step a day at a time and times
 * are typed. Same props as date-field.tsx.
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
  const today = format(new Date(), "yyyy-MM-dd");
  const step = (n: number) => {
    const next = format(addDays(parseISO(value || min || today), n), "yyyy-MM-dd");
    onChange(min && next < min ? min : next);
  };
  const btn = (title: string, onPress: () => void, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={[styles.btn, { borderColor: t.border, backgroundColor: t.surface }]}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {optional && !value ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(min && min > today ? min : today)}
          style={[styles.btn, { borderColor: t.border, backgroundColor: t.surface, alignSelf: "flex-start", paddingHorizontal: 14 }]}
        >
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

/** A start time as "HH:mm" (24-hour), or "" for none. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; clock?: "12h" | "24h" }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder="07:30 (24-hour)"
        placeholderTextColor={t.muted}
        keyboardType="numbers-and-punctuation"
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: t.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  btn: { height: 44, minWidth: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 16 },
});
