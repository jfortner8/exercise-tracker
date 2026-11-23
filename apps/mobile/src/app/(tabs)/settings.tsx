import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { DeleteAccountResponse, MeResponse } from "@et/core/api-types";
import { calendarHabit, HABIT_KINDS, HABITS, profileHabits, type HabitKind } from "@et/core/habits";
import type { Profile, Share } from "@et/core/types";
import { api, ApiError, deviceTimeZone } from "@/api/client";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { API_URL } from "@/config";
import { CalendarFeed } from "@/screens/settings/CalendarFeed";
import { GoalsEditor } from "@/screens/settings/GoalsEditor";
import { Reminders } from "@/screens/settings/Reminders";
import { loadReminders, saveReminders } from "@/reminders";
import { OPTIONAL_TABS } from "@/screens/tabs";
import { useTheme } from "@/theme";
import { useThemePref } from "@/theme-pref";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/ui";
import { ask } from "@/ui/confirm";
import { Chips, SectionTitle, SwitchRow } from "@/ui/form";

const SHARE_OPTIONS: { value: Share; label: string; description: string }[] = [
  { value: "off", label: "Nobody", description: "You don't appear on any leaderboard." },
  { value: "circle", label: "Friends & clubs", description: "Your friends and the members of your clubs. Not on the Everyone board." },
  { value: "everyone", label: "Everyone", description: "Friends and clubs, plus the Everyone board that anyone with an account can see." },
];

/** The website's Settings: profile, units, theme, optional tracking, sharing, calendar feed, account. */
export default function Settings() {
  const me = useMe();
  const { signOut } = useSession();
  const qc = useQueryClient();
  const t = useTheme();
  const [theme, setTheme] = useThemePref();
  // Unsaved edits; until the first one, the form shows the saved settings.
  const [draft, setDraft] = useState<Profile | null>(null);
  const p = draft ?? me.data?.profile ?? null;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const flags = me.data?.navFlags ?? {};
  const earned = Platform.OS === "android" ? OPTIONAL_TABS.filter((x) => x.flag && flags[x.flag]) : [];
  const edit = (patch: Partial<Profile>) => {
    setSaved(false);
    if (p) setDraft({ ...p, ...patch });
  };

  async function save() {
    if (!p) return;
    const habits = profileHabits(p);
    setSaving(true);
    setError(null);
    try {
      const r = await api<MeResponse>("/me/profile", {
        method: "PUT",
        body: {
          displayName: p.displayName,
          units: p.units,
          weekStartsOn: p.weekStartsOn,
          clock: p.clock ?? "12h",
          habits,
          habitOnCalendar: calendarHabit(p) ?? undefined,
          goals: (p.goals ?? []).map(({ id, name, emoji, off }) => ({ id, name, emoji, off })),
          goalOnCalendar: p.goalOnCalendar,
          share: p.share,
          shareConsistency: p.share !== "off" && p.shareConsistency === true,
          trackWeight: p.trackWeight,
          timeZone: deviceTimeZone(),
        },
      });
      // Turning weight tracking off (or on) drops (or restores) the weigh-in reminder.
      if (r.profile.trackWeight !== me.data?.profile.trackWeight && Platform.OS !== "web")
        void loadReminders().then((rp) => saveReminders(rp, r.profile.trackWeight)).catch(() => {});
      qc.setQueryData(["me"], r);
      setDraft(null);
      setSaved(true);
      await Promise.all([qc.invalidateQueries({ queryKey: ["calendar"] }), qc.invalidateQueries({ queryKey: ["leaderboards"] })]);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    const sure = await ask(
      "Delete your account?",
      "This deletes your account and everything in it: workouts, notes, results, friendships and club memberships. It can't be undone.",
      "Delete account",
      true,
    );
    if (!sure) return;
    setDeleting(true);
    setError(null);
    try {
      await api<DeleteAccountResponse>("/me", { method: "DELETE", body: { confirm: true } });
      await signOut();
    } catch (e) {
      setError((e as ApiError).message);
      setDeleting(false);
    }
  }

  const habits = p ? profileHabits(p) : [];
  const toggleHabit = (k: HabitKind, on: boolean) => edit({ habits: HABIT_KINDS.filter((h) => (h === k ? on : habits.includes(h))) });

  return (
    <Screen onRefresh={() => {
        setDraft(null);
        void me.refetch();
      }} refreshing={me.isRefetching}>
      <Title>Settings</Title>
      <ErrorText>{me.error?.message}</ErrorText>

      {earned.length > 0 && (
        <Card>
          {earned.map((x) => (
            <Button key={x.name} title={x.label} variant="secondary" onPress={() => router.push({ pathname: "/more/[screen]", params: { screen: x.name } })} />
          ))}
        </Card>
      )}

      {p && (
        <>
          <Card>
            <Field label="Display name" value={p.displayName} onChangeText={(v) => edit({ displayName: v })} maxLength={80} />
            <Body muted style={{ marginBottom: 12 }}>{p.email}</Body>
            <Chips
              label="Distance"
              options={[{ value: "mi", label: "Miles" }, { value: "km", label: "Kilometers" }]}
              value={p.units.distance}
              onChange={(v) => v && edit({ units: { ...p.units, distance: v } })}
            />
            <Chips
              label="Weight"
              options={[{ value: "lb", label: "Pounds (lb)" }, { value: "kg", label: "Kilograms (kg)" }]}
              value={p.units.weight}
              onChange={(v) => v && edit({ units: { ...p.units, weight: v } })}
            />
            <Chips
              label="Week starts on"
              options={[{ value: 1, label: "Monday" }, { value: 0, label: "Sunday" }]}
              value={p.weekStartsOn}
              onChange={(v) => v !== "" && edit({ weekStartsOn: v as 0 | 1 })}
            />
            <Chips
              label="Time format"
              options={[{ value: "12h", label: "12-hour (6:30 PM)" }, { value: "24h", label: "24-hour (18:30)" }]}
              value={p.clock ?? "12h"}
              onChange={(v) => v && edit({ clock: v })}
            />
          </Card>

          <Card>
            <SectionTitle>Appearance</SectionTitle>
            <Chips
              label="Saved on this phone and applied right away"
              options={[{ value: "system", label: "Match phone" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
              value={theme}
              onChange={(v) => v && setTheme(v)}
            />
          </Card>

          <Card>
            <SectionTitle>Optional tracking</SectionTitle>
            <Body style={{ fontWeight: "600" }}>Daily counters</Body>
            <Body muted style={{ fontSize: 14 }}>Count these from the day view. Turning one off hides it but keeps what you logged.</Body>
            {HABIT_KINDS.map((k) => (
              <SwitchRow key={k} label={HABITS[k].label} value={habits.includes(k)} onChange={(v) => toggleHabit(k, v)} />
            ))}
            {habits.length > 1 && (
              <Chips
                label="Show on calendar"
                options={habits.map((k) => ({ value: k, label: HABITS[k].label }))}
                value={calendarHabit(p) ?? undefined}
                onChange={(v) => v && edit({ habitOnCalendar: v })}
              />
            )}
            <View style={{ height: 12 }} />
            <GoalsEditor
              goals={p.goals ?? []}
              onCalendar={p.goalOnCalendar}
              // New goals get their start date when saved.
              onChange={(goals) => edit({ goals: goals.map((g) => ({ start: "", ...p.goals?.find((x) => x.id === g.id), ...g })) })}
              onPick={(id) => edit({ goalOnCalendar: id })}
            />
            <View style={{ height: 12 }} />
            <SwitchRow label="Track bodyweight" value={p.trackWeight} onChange={(v) => edit({ trackWeight: v })} />
            <Body muted style={{ fontSize: 14 }}>Log one weight per day from the day view. It shows on the calendar on days you log it.</Body>
          </Card>

          <Card>
            <SectionTitle>Who sees my PBs on leaderboards</SectionTitle>
            <Body muted style={{ fontSize: 14, marginBottom: 8 }}>
              Your display name and best results on built-in benchmarks. Custom benchmarks always stay private.
            </Body>
            {SHARE_OPTIONS.map((o) => {
              const on = p.share === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => edit({ share: o.value })}
                  style={{ borderWidth: 1, borderRadius: 10, borderColor: on ? t.accent : t.border, backgroundColor: on ? t.surface2 : t.surface, padding: 12, marginBottom: 8 }}
                >
                  <Text style={{ color: t.text, fontWeight: "600", fontSize: 15 }}>{o.label}</Text>
                  <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{o.description}</Text>
                </Pressable>
              );
            })}
            {p.share !== "off" && (
              <>
                <SwitchRow label="Also show my consistency" value={p.shareConsistency === true} onChange={(v) => edit({ shareConsistency: v })} />
                <Body muted style={{ fontSize: 14 }}>
                  The % of days you were on track over the last 4 weeks, on the Consistency board for your friends and clubs. Never on the Everyone board.
                </Body>
              </>
            )}
          </Card>

          <ErrorText>{error}</ErrorText>
          <Button title={saved ? "Saved" : "Save settings"} onPress={() => void save()} loading={saving} disabled={!p.displayName.trim()} />
          <View style={{ height: 20 }} />

          <Reminders trackWeight={me.data?.profile.trackWeight ?? false} clock={me.data?.profile.clock} />
          <CalendarFeed />
        </>
      )}

      <Button title="Privacy" variant="link" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Button title="Delete account" variant="danger" onPress={() => void deleteAccount()} loading={deleting} />
    </Screen>
  );
}
