import { useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { GOAL_NAME_MAX, GOAL_PRESETS, goalLabel, MAX_GOALS, type Goal } from "@et/core/goals";
import { useTheme } from "@/theme";
import { Body, Button } from "@/ui";
import { ask } from "@/ui/confirm";
import { Chips, SwitchRow } from "@/ui/form";

type Draft = Pick<Goal, "id" | "name" | "emoji" | "off">;

const newId = () => Array.from({ length: 24 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");

/**
 * Yes/no daily goals: the common ones are always listed, your own below. Switching one off keeps
 * it (and its check-offs) so switching it back on restores it. Saved with the settings form.
 */
export function GoalsEditor({
  goals,
  onCalendar,
  onChange,
  onPick,
}: {
  goals: Draft[];
  onCalendar?: string;
  onChange: (goals: Draft[]) => void;
  onPick: (id: string) => void;
}) {
  const t = useTheme();
  const [name, setName] = useState("");
  const tracked = goals.filter((g) => !g.off);
  const full = tracked.length >= MAX_GOALS;
  const presetIds = new Set(GOAL_PRESETS.map((p) => p.id));
  const rows = [
    ...GOAL_PRESETS.map((p) => {
      const saved = goals.find((g) => g.id === p.id);
      return { goal: saved ?? p, on: !!saved && !saved.off, preset: true };
    }),
    ...goals.filter((g) => !presetIds.has(g.id)).map((g) => ({ goal: g, on: !g.off, preset: false })),
  ];
  const taken = (n: string) => rows.some((r) => r.goal.name.trim().toLowerCase() === n.trim().toLowerCase());
  const setOn = (g: Draft, on: boolean) =>
    goals.some((x) => x.id === g.id) ? onChange(goals.map((x) => (x.id === g.id ? { ...x, off: !on } : x))) : onChange([...goals, { ...g, off: !on }]);
  const addCustom = () => {
    const n = name.trim();
    if (!n || taken(n)) return;
    onChange([...goals, { id: newId(), name: n, off: full }]);
    setName("");
  };
  const shown = tracked.find((g) => g.id === onCalendar) ?? tracked[0];
  const input = { color: t.text, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 10, height: 40, paddingHorizontal: 10, fontSize: 15, flex: 1 } as const;

  return (
    <View>
      <Body style={{ fontWeight: "600" }}>Daily goals</Body>
      <Body muted style={{ fontSize: 14, marginBottom: 6 }}>Yes-or-no things to do each day. Check them off from the day view.</Body>
      {rows.map(({ goal: g, on, preset }) =>
        preset ? (
          <SwitchRow key={g.id} label={goalLabel(g)} value={on} onChange={(v) => (!v || !full ? setOn(g, v) : undefined)} />
        ) : (
          <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TextInput
              accessibilityLabel="Goal name"
              value={g.name}
              maxLength={GOAL_NAME_MAX}
              onChangeText={(v) => onChange(goals.map((x) => (x.id === g.id ? { ...x, name: v } : x)))}
              style={input}
            />
            <Button
              title="Delete"
              variant="link"
              onPress={async () => {
                if (await ask(`Delete "${g.name}"?`, "Its check-offs will no longer show. To pause it instead, switch it off.", "Delete", true))
                  onChange(goals.filter((x) => x.id !== g.id));
              }}
            />
            <Switch accessibilityLabel={`Track ${g.name}`} value={on} onValueChange={(v) => (!v || !full ? setOn(g, v) : undefined)} trackColor={{ true: t.accent }} />
          </View>
        ),
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <TextInput
          accessibilityLabel="New goal"
          value={name}
          maxLength={GOAL_NAME_MAX}
          placeholder="Your own, e.g. Meditated"
          placeholderTextColor={t.muted}
          onChangeText={setName}
          onSubmitEditing={addCustom}
          style={input}
        />
        <Button title="Add" variant="secondary" disabled={!name.trim() || taken(name)} onPress={addCustom} />
      </View>
      {name.trim() && taken(name) ? <Text style={{ color: t.danger, fontSize: 12, marginTop: 4 }}>You already have that goal.</Text> : null}
      {full ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>You&apos;re tracking {MAX_GOALS}, the most at once. Switch one off to track another.</Text> : null}
      {tracked.length > 1 && (
        <View style={{ marginTop: 10 }}>
          <Chips label="Show on calendar" options={tracked.map((g) => ({ value: g.id, label: goalLabel(g) }))} value={shown?.id} onChange={(v) => v && onPick(v)} />
        </View>
      )}
    </View>
  );
}
