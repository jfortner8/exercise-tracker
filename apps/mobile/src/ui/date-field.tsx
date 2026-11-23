import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { format, parseISO } from "date-fns";
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { formatStartTime } from "@et/core/domain";
import { useTheme } from "@/theme";

/*
 * The phone's own date and time pickers: iOS's compact pickers in the row, Android's dialogs on a
 * tap. Dates are yyyy-MM-dd and times "HH:mm", as the API takes them.
 */

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const hhmm = (d: Date) => format(d, "HH:mm");
/** "HH:mm" on today's date, for the time picker. */
const timeToDate = (v: string) => {
  const d = new Date();
  const [h, m] = (v || "07:00").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>
    </View>
  );
}

function Chip({ text, onPress, a11y, muted }: { text: string; onPress: () => void; a11y?: string; muted?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { borderColor: t.border, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: muted ? t.muted : t.text, fontSize: 16, fontWeight: muted ? "400" : "600" }}>{text}</Text>
    </Pressable>
  );
}

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
  const scheme = useColorScheme();
  const today = ymd(new Date());
  const minimumDate = min ? parseISO(min) : undefined;
  const set = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === "set" && d) onChange(ymd(d));
  };
  const openAndroid = () =>
    DateTimePickerAndroid.open({ value: parseISO(value || (min && min > today ? min : today)), mode: "date", minimumDate, onChange: set });
  const clear = optional && value ? <Chip text="✕" a11y={`Clear ${label}`} onPress={() => onChange("")} /> : null;

  if (optional && !value) {
    return (
      <Shell label={label}>
        <Chip
          text="Not set · tap to set"
          muted
          onPress={() => (Platform.OS === "android" ? openAndroid() : onChange(min && min > today ? min : today))}
        />
      </Shell>
    );
  }
  if (Platform.OS === "ios") {
    return (
      <Shell label={label}>
        <DateTimePicker
          value={parseISO(value)}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          accentColor={t.accentInk}
          themeVariant={scheme === "dark" ? "dark" : "light"}
          onChange={set}
          accessibilityLabel={label}
        />
        {clear}
      </Shell>
    );
  }
  return (
    <Shell label={label}>
      <Chip text={format(parseISO(value), "EEE, MMM d, yyyy")} a11y={`${label}, ${format(parseISO(value), "EEEE, MMMM d, yyyy")}`} onPress={openAndroid} />
      {clear}
    </Shell>
  );
}

/** A start time as "HH:mm", or "" for none (a start time is optional). */
export function TimeField({ label, value, onChange, clock }: { label: string; value: string; onChange: (v: string) => void; clock?: "12h" | "24h" }) {
  const t = useTheme();
  const scheme = useColorScheme();
  const set = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === "set" && d) onChange(hhmm(d));
  };
  const openAndroid = () => DateTimePickerAndroid.open({ value: timeToDate(value), mode: "time", is24Hour: clock === "24h", onChange: set });
  const valid = /^\d{2}:\d{2}$/.test(value);

  if (!valid) {
    return (
      <Shell label={label}>
        <Chip text="No start time · tap to set" muted onPress={() => (Platform.OS === "android" ? openAndroid() : onChange("07:00"))} />
      </Shell>
    );
  }
  return (
    <Shell label={label}>
      {Platform.OS === "ios" ? (
        <DateTimePicker
          value={timeToDate(value)}
          mode="time"
          display="compact"
          accentColor={t.accentInk}
          themeVariant={scheme === "dark" ? "dark" : "light"}
          onChange={set}
          accessibilityLabel={label}
        />
      ) : (
        <Chip text={formatStartTime(value, clock)} a11y={`${label}, ${formatStartTime(value, clock)}`} onPress={openAndroid} />
      )}
      <Chip text="✕" a11y={`Clear ${label}`} onPress={() => onChange("")} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  chip: { height: 44, minWidth: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
});
