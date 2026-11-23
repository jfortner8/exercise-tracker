import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Share, Text, View } from "react-native";
import type { CalendarFeedResponse } from "@et/core/api-types";
import { useAction } from "@/api/action";
import { api, deviceTimeZone } from "@/api/client";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText } from "@/ui";
import { ask } from "@/ui/confirm";
import { SectionTitle, SwitchRow } from "@/ui/form";

/** "Show on your calendar": a private link the phone's Calendar (or Google, Outlook) subscribes to. */
export function CalendarFeed() {
  const t = useTheme();
  const q = useQuery({ queryKey: ["calendar-feed"], queryFn: () => api<CalendarFeedResponse>("/calendar-feed") });
  const act = useAction([["calendar-feed"]]);
  const d = q.data;
  const [copied, setCopied] = useState(false);
  const setOptions = (o: { includeNotes: boolean; plannedOnly: boolean }) => void act.run(() => api("/calendar-feed/options", { method: "PUT", body: o }));

  return (
    <Card>
      <SectionTitle>Show on your calendar</SectionTitle>
      <Body muted style={{ fontSize: 14 }}>
        Subscribe to your workouts from the Calendar app, Google Calendar or Outlook. They update on their own; Google can take up to a day to show changes.
      </Body>
      <ErrorText>{act.error ?? q.error?.message}</ErrorText>
      {d && !d.enabled ? (
        <Button title="Get my calendar link" loading={act.pending} onPress={() => void act.run(() => api("/calendar-feed", { body: { timeZone: deviceTimeZone() } }))} />
      ) : d?.url ? (
        <>
          <View style={{ backgroundColor: t.surface2, borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 8 }}>
            <Text selectable style={{ color: t.text, fontSize: 12 }}>
              {d.url}
            </Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 6 }}>
            Anyone with this link can see these workouts. Keep it to yourself, or reset it to cut off old copies.
          </Text>
          {d.webcalUrl ? <Button title="Subscribe in Calendar" onPress={() => void Linking.openURL(d.webcalUrl!).catch(() => {})} /> : null}
          <Button
            title={copied ? "Copied" : "Copy link"}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(d.url!).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          />
          <Button title="Share link" variant="secondary" onPress={() => void Share.share({ message: d.url! }).catch(() => {})} />
          <SwitchRow label="Include workout notes" value={d.includeNotes} onChange={(v) => setOptions({ includeNotes: v, plannedOnly: d.plannedOnly })} />
          <SwitchRow label="Only upcoming planned workouts" value={d.plannedOnly} onChange={(v) => setOptions({ includeNotes: d.includeNotes, plannedOnly: v })} />
          <Button
            title="Reset link"
            variant="link"
            onPress={async () => {
              if (await ask("Make a new calendar link?", "The old link stops working, so calendars subscribed to it stop updating.", "Reset"))
                void act.run(() => api("/calendar-feed/reset", { body: {} }));
            }}
          />
          <Button
            title="Turn off"
            variant="link"
            onPress={async () => {
              if (await ask("Turn off the calendar link?", "Calendars subscribed to it stop updating.", "Turn off", true))
                void act.run(() => api("/calendar-feed", { method: "DELETE" }));
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
