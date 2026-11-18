"use client";

import { CalendarPlus, Check, Copy, ExternalLink } from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  disableCalendarFeedAction,
  enableCalendarFeedAction,
  resetCalendarFeedAction,
  saveCalendarOptionsAction,
} from "@/lib/calendar-actions";
import type { Profile } from "@/lib/types";
import { Button, Card, cx } from "./ui";

const noSubscribe = () => () => {};
const useOrigin = () => useSyncExternalStore(noSubscribe, () => location.origin, () => "");
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Settings → "Show on your calendar": a private link Google Calendar, Outlook or Apple Calendar subscribes to. */
export function CalendarFeed({ profile }: { profile: Profile }) {
  const origin = useOrigin();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(profile.calendarIncludeNotes === true);
  const [plannedOnly, setPlannedOnly] = useState(profile.calendarPlannedOnly === true);
  const token = profile.calendarToken;

  const run = (f: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await f();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  const saveOptions = (o: { includeNotes: boolean; plannedOnly: boolean }) => {
    setIncludeNotes(o.includeNotes);
    setPlannedOnly(o.plannedOnly);
    run(() => saveCalendarOptionsAction(o));
  };

  const url = token && origin ? `${origin}/cal/${token}.ics` : "";
  const webcal = url.replace(/^https?:/, "webcal:");
  const links = url
    ? [
        { label: "Google Calendar", href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` },
        { label: "Outlook.com", href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=Workouts` },
        { label: "Outlook (work or school)", href: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=Workouts` },
        { label: "Apple Calendar", href: webcal },
      ]
    : [];

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Show on your calendar</h2>
        <p className="mt-0.5 text-sm text-muted">
          Subscribe to your workouts from Google Calendar, Outlook or Apple Calendar. They update on their own; Google
          can take up to a day to show changes, Outlook a few hours.
        </p>
      </div>

      {!token ? (
        <Button type="button" disabled={pending} onClick={() => run(() => enableCalendarFeedAction(browserZone()))}>
          <CalendarPlus className="size-4" /> {pending ? "Turning on…" : "Get my calendar link"}
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                aria-label="Your private calendar link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={!url}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {}
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted">
              Anyone with this link can see these workouts. Keep it to yourself, or reset it to cut off old copies.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Add it to</h3>
            <div className="grid grid-cols-2 gap-2">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target={l.href.startsWith("webcal:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
                >
                  {l.label} <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Anywhere else: paste the link into its &ldquo;subscribe&rdquo; or &ldquo;add calendar from URL&rdquo; option.
            </p>
          </div>

          <div className="space-y-3">
            <Checkbox checked={plannedOnly} onChange={(v) => saveOptions({ includeNotes, plannedOnly: v })} disabled={pending}>
              Only planned workouts <span className="text-muted">(leave out ones already logged)</span>
            </Checkbox>
            <Checkbox checked={includeNotes} onChange={(v) => saveOptions({ includeNotes: v, plannedOnly })} disabled={pending}>
              Include my workout notes
            </Checkbox>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                confirm("Make a new link? Calendars using the old one will stop updating until you add the new one.") &&
                run(() => resetCalendarFeedAction(browserZone()))
              }
            >
              Reset link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                confirm("Turn off the calendar link? Calendars using it will stop updating.") && run(disableCalendarFeedAction)
              }
            >
              Turn off
            </Button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2 text-sm", disabled && "opacity-70")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[var(--accent)]"
      />
      <span>{children}</span>
    </label>
  );
}
