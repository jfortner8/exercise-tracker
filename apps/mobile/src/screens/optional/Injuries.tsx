import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useState } from "react";
import { Text, View } from "react-native";
import type { InjuriesResponse } from "@et/core/api-types";
import type { Injury } from "@et/core/types";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { useTheme } from "@/theme";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/ui";
import { ask } from "@/ui/confirm";
import { Chips, DateField, Row } from "@/ui/form";
import { Empty } from "@/ui/list";

type Pain = { date: string; level: number; title: string };

/** Injuries: current ones first, with how long they've lasted and the pain logged on linked workouts. */
export function Injuries({ header }: { header?: boolean }) {
  const t = useTheme();
  const today = useMe().data?.today ?? format(new Date(), "yyyy-MM-dd");
  const q = useQuery({ queryKey: ["injuries"], queryFn: () => api<InjuriesResponse>("/injuries") });
  const act = useAction([["injuries"], ["calendar"], ["me"]]);
  const [editing, setEditing] = useState<Injury | "new" | null>(null);
  const sorted = [...(q.data?.injuries ?? [])].sort(
    (a, b) => Number(a.status === "healed") - Number(b.status === "healed") || b.startDate.localeCompare(a.startDate),
  );
  const badge = (s: Injury["status"]) =>
    s === "active" ? { bg: t.injury, fg: t.danger } : s === "recovering" ? { bg: t.warnBg, fg: t.warn } : { bg: t.surface2, fg: t.muted };

  return (
    <Screen header={header} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Injured days don't count against your consistency.">Injuries</Title>
      <ErrorText>{act.error ?? q.error?.message}</ErrorText>
      {editing ? (
        <InjuryForm injury={editing === "new" ? undefined : editing} today={today} onClose={() => setEditing(null)} />
      ) : (
        <Button title="+ Log an injury" onPress={() => setEditing("new")} />
      )}
      <View style={{ height: 12 }} />
      {q.data && !sorted.length && <Empty>No injuries logged. Long may it last.</Empty>}
      {sorted.map((i) => {
        const days = differenceInCalendarDays(i.endDate ? parseISO(i.endDate) : parseISO(today), parseISO(i.startDate)) + 1;
        const points: Pain[] = q.data?.pain[i.id] ?? [];
        const b = badge(i.status);
        return (
          <Card key={i.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Body style={{ fontWeight: "700" }}>{i.name}</Body>
              <Text style={{ backgroundColor: b.bg, color: b.fg, fontSize: 12, fontWeight: "600", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", textTransform: "capitalize" }}>
                {i.status}
              </Text>
            </View>
            <Body muted style={{ fontSize: 13, marginTop: 2 }}>
              {i.bodyPart ? `${i.bodyPart} · ` : ""}
              {format(parseISO(i.startDate), "MMM d, yyyy")} – {i.endDate ? format(parseISO(i.endDate), "MMM d, yyyy") : "now"} · {days} day{days === 1 ? "" : "s"}
            </Body>
            {i.notes ? <Body style={{ marginTop: 6, fontSize: 14 }}>{i.notes}</Body> : null}
            {points.length > 0 && (
              <View style={{ marginTop: 10 }} accessibilityLabel={`Pain in linked workouts: ${points.map((p) => `${p.level} of 10`).join(", ")}`}>
                <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Pain in linked workouts</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 48 }}>
                  {points.map((p, idx) => (
                    <View key={idx} style={{ width: 10, borderRadius: 2, backgroundColor: t.danger, opacity: 0.7, height: `${Math.max(8, p.level * 10)}%` }} />
                  ))}
                </View>
              </View>
            )}
            <Row>
              {i.status !== "healed" && (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Mark healed"
                    variant="secondary"
                    onPress={() => void act.run(() => api(`/injuries/${i.id}`, { method: "PUT", body: { ...i, id: undefined, status: "healed", endDate: i.endDate ?? today } }))}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Button title="Edit" variant="secondary" onPress={() => setEditing(i)} />
              </View>
            </Row>
            <Button
              title="Delete"
              variant="link"
              onPress={async () => {
                if (await ask(`Delete "${i.name}"?`, "Workouts linked to it are left as they are.", "Delete", true))
                  void act.run(() => api(`/injuries/${i.id}`, { method: "DELETE" }));
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

/** Add or edit an injury. Also used from the day sheet, starting on that day. */
export function InjuryForm({ injury, today, startDate, onClose }: { injury?: Injury; today: string; startDate?: string; onClose: () => void }) {
  const [v, setV] = useState({
    name: injury?.name ?? "",
    bodyPart: injury?.bodyPart ?? "",
    startDate: injury?.startDate ?? startDate ?? today,
    endDate: injury?.endDate ?? "",
    status: injury?.status ?? ("active" as Injury["status"]),
    notes: injury?.notes ?? "",
  });
  const act = useAction([["injuries"], ["calendar"], ["me"]]);
  async function save() {
    const body = {
      name: v.name,
      bodyPart: v.bodyPart || undefined,
      startDate: v.startDate,
      endDate: v.endDate || undefined,
      status: v.status,
      notes: v.notes || undefined,
    };
    const r = await act.run(() => (injury ? api(`/injuries/${injury.id}`, { method: "PUT", body }) : api("/injuries", { body })));
    if (r) onClose();
  }
  return (
    <Card>
      <Body style={{ fontWeight: "700", marginBottom: 10 }}>{injury ? "Edit injury" : "Log an injury"}</Body>
      <Field label="Name" value={v.name} onChangeText={(name) => setV({ ...v, name })} placeholder="Ankle tendinitis" maxLength={120} />
      <Field label="Body part" value={v.bodyPart} onChangeText={(bodyPart) => setV({ ...v, bodyPart })} placeholder="Left ankle" maxLength={80} />
      <Chips
        label="Status"
        options={[{ value: "active" as const, label: "Active" }, { value: "recovering" as const, label: "Recovering" }, { value: "healed" as const, label: "Healed" }]}
        value={v.status}
        onChange={(status) => status && setV({ ...v, status })}
      />
      <DateField label="Started" value={v.startDate} onChange={(startDate) => setV({ ...v, startDate, endDate: v.endDate && v.endDate < startDate ? startDate : v.endDate })} />
      <DateField label="Ended" value={v.endDate} onChange={(endDate) => setV({ ...v, endDate })} optional min={v.startDate} />
      <Field label="Notes" value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} placeholder="Doctor said 1–2 more weeks…" multiline style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 10 }} maxLength={5000} />
      <ErrorText>{act.error}</ErrorText>
      <Button title="Save" onPress={() => void save()} loading={act.pending} disabled={!v.name.trim()} />
      <Button title="Cancel" variant="link" onPress={onClose} />
    </Card>
  );
}
