"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { HeartPulse, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteInjuryAction, saveInjuryAction } from "@/lib/actions";
import { ymd } from "@/lib/domain";
import type { Injury } from "@/lib/types";
import { Sheet } from "./sheet";
import { Button, Card, Field, Input, Select, Textarea, cx } from "./ui";

type Pain = { date: string; level: number; title: string };

export function InjuryList({ injuries, pain }: { injuries: Injury[]; pain: Record<string, Pain[]> }) {
  const [editing, setEditing] = useState<Injury | "new" | null>(null);
  const [pending, start] = useTransition();
  const sorted = [...injuries].sort(
    (a, b) => Number(a.status === "healed") - Number(b.status === "healed") || b.startDate.localeCompare(a.startDate),
  );

  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={() => setEditing("new")}>
        <Plus className="size-4" /> Log an injury
      </Button>

      {sorted.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">
          <HeartPulse className="mx-auto mb-2 size-6" />
          No injuries logged. Long may it last.
        </Card>
      )}

      {sorted.map((i) => {
        const end = i.endDate ? parseISO(i.endDate) : new Date();
        const days = differenceInCalendarDays(end, parseISO(i.startDate)) + 1;
        const points = pain[i.id] ?? [];
        return (
          <Card key={i.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{i.name}</h3>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      i.status === "active" && "bg-danger/10 text-danger",
                      i.status === "recovering" && "bg-warn/15 text-warn",
                      i.status === "healed" && "bg-surface-2 text-muted",
                    )}
                  >
                    {i.status}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {i.bodyPart && `${i.bodyPart} · `}
                  {format(parseISO(i.startDate), "MMM d, yyyy")} – {i.endDate ? format(parseISO(i.endDate), "MMM d, yyyy") : "now"} ·{" "}
                  {days} day{days === 1 ? "" : "s"}
                </p>
                {i.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{i.notes}</p>}
                {points.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-medium text-muted">Pain in linked workouts</div>
                    <div className="flex h-12 items-end gap-1">
                      {points.map((p, idx) => (
                        <div
                          key={idx}
                          title={`${format(parseISO(p.date), "MMM d")} · ${p.title} · ${p.level}/10`}
                          className="w-3 rounded-sm bg-danger/70"
                          style={{ height: `${Math.max(8, p.level * 10)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                {i.status !== "healed" && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => start(() => saveInjuryAction({ ...i, status: "healed", endDate: i.endDate ?? ymd(new Date()) }))}
                  >
                    Mark healed
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(i)} aria-label="Edit">
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  aria-label="Delete"
                  disabled={pending}
                  onClick={() => confirm(`Delete "${i.name}"?`) && start(() => deleteInjuryAction(i.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {editing && (
        <InjuryForm injury={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function InjuryForm({ injury, onClose }: { injury?: Injury; onClose: () => void }) {
  const [v, setV] = useState({
    name: injury?.name ?? "",
    bodyPart: injury?.bodyPart ?? "",
    startDate: injury?.startDate ?? ymd(new Date()),
    endDate: injury?.endDate ?? "",
    status: injury?.status ?? ("active" as Injury["status"]),
    notes: injury?.notes ?? "",
  });
  const [pending, start] = useTransition();

  return (
    <Sheet variant="dialog" title={injury ? "Edit injury" : "Log an injury"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await saveInjuryAction({
              id: injury?.id,
              name: v.name,
              bodyPart: v.bodyPart || undefined,
              startDate: v.startDate,
              endDate: v.endDate || undefined,
              status: v.status,
              notes: v.notes || undefined,
            });
            onClose();
          });
        }}
      >
        <Field label="Name">
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ankle tendinitis" required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Body part">
            <Input value={v.bodyPart} onChange={(e) => setV({ ...v, bodyPart: e.target.value })} placeholder="Left ankle" />
          </Field>
          <Field label="Status">
            <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Injury["status"] })}>
              <option value="active">Active</option>
              <option value="recovering">Recovering</option>
              <option value="healed">Healed</option>
            </Select>
          </Field>
          <Field label="Started">
            <Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} required />
          </Field>
          <Field label="Ended">
            <Input type="date" value={v.endDate} min={v.startDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Doctor said 1–2 more weeks…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
