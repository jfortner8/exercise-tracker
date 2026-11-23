import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { allowNotifications, DEFAULT_REMINDERS, loadReminders, saveReminders, type ReminderPrefs } from "@/reminders";
import { Body, Card, ErrorText } from "@/ui";
import { Chips, SectionTitle, SwitchRow, TimeField } from "@/ui/form";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Settings → Reminders: a daily nudge to log, and a weekly weigh-in. Scheduled on the phone. */
export function Reminders({ trackWeight, clock }: { trackWeight: boolean; clock?: "12h" | "24h" }) {
  const [p, setP] = useState<ReminderPrefs>(DEFAULT_REMINDERS);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadReminders().then(setP);
  }, []);
  if (Platform.OS === "web") return null;

  async function change(patch: Partial<ReminderPrefs>) {
    const next = { ...p, ...patch };
    setError(null);
    const turningOn = (patch.daily && !p.daily) || (patch.weigh && !p.weigh);
    if (turningOn && !(await allowNotifications())) {
      setError("Notifications are off for this app. Turn them on in your phone's Settings, then try again.");
      return;
    }
    setP(next);
    try {
      await saveReminders(next, trackWeight);
    } catch {
      setError("Couldn't set the reminder. Try again.");
    }
  }

  return (
    <Card>
      <SectionTitle>Reminders</SectionTitle>
      <Body muted style={{ fontSize: 14 }}>Set on this phone. Nothing is sent anywhere.</Body>
      <SwitchRow label="Daily reminder to log" value={p.daily} onChange={(daily) => void change({ daily })} />
      {p.daily && <TimeField label="At" value={p.dailyTime} clock={clock} onChange={(v) => v && void change({ dailyTime: v })} />}
      {trackWeight && (
        <>
          <SwitchRow label="Weekly weigh-in reminder" value={p.weigh} onChange={(weigh) => void change({ weigh })} />
          {p.weigh && (
            <>
              <Chips options={DAYS.map((label, value) => ({ value, label }))} value={p.weighDay} onChange={(v) => v !== "" && void change({ weighDay: v })} />
              <TimeField label="At" value={p.weighTime} clock={clock} onChange={(v) => v && void change({ weighTime: v })} />
            </>
          )}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
