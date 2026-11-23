"use client";

import { CalendarPlus, Check, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  disableCalendarFeedAction,
  enableCalendarFeedAction,
  resetCalendarFeedAction,
  saveCalendarOptionsAction,
} from "@/lib/calendar-actions";
import type { Profile } from "@et/core/types";
import { Sheet } from "./sheet";
import { Button, Card, cx } from "./ui";

const noSubscribe = () => () => {};
const useOrigin = () => useSyncExternalStore(noSubscribe, () => location.origin, () => "");
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Settings → "Show on your calendar": a private link Google Calendar, Outlook or Apple Calendar subscribes to. */
export function CalendarFeed({ profile }: { profile: Profile }) {
  const origin = useOrigin();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<GuideKey | null>(null);
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
              <CopyButton text={url} />
            </div>
            <p className="text-xs text-muted">
              Anyone with this link can see these workouts. Keep it to yourself, or reset it to cut off old copies.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">How to add it</h3>
            <div className="grid grid-cols-2 gap-2">
              {GUIDES.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGuide(g.key)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  {g.label} <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </button>
              ))}
            </div>
          </div>
          {guide && url && <GuideSheet guide={guide} url={url} onClose={() => setGuide(null)} />}

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : label}
    </Button>
  );
}

type GuideKey = "google" | "outlook" | "apple" | "other";
const GUIDES: { key: GuideKey; label: string }[] = [
  { key: "google", label: "Google Calendar" },
  { key: "outlook", label: "Outlook" },
  { key: "apple", label: "iPhone / Mac" },
  { key: "other", label: "Something else" },
];

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-text">{children}</strong>;

function Steps({ title, steps }: { title?: string; steps: ReactNode[] }) {
  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("webcal:") ? undefined : "_blank"}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
    >
      {children} <ExternalLink className="size-3.5 text-muted" aria-hidden />
    </a>
  );
}

const GUIDE_TITLE: Record<GuideKey, string> = {
  google: "Add to Google Calendar",
  outlook: "Add to Outlook",
  apple: "Add to iPhone or Mac",
  other: "Add to another calendar",
};

/** Step-by-step instructions for one calendar app, with the link to copy right there. */
function GuideSheet({ guide, url, onClose }: { guide: GuideKey; url: string; onClose: () => void }) {
  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <Sheet variant="dialog" title={GUIDE_TITLE[guide]} onClose={onClose}>
      <div className="space-y-5 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{url}</span>
          <CopyButton text={url} label="Copy link" />
        </div>
        {guide === "google" && (
          <>
            <Steps
              title="On a computer"
              steps={[
                <>Copy the link above.</>,
                <>
                  Go to <B>calendar.google.com</B> and sign in.
                </>,
                <>
                  Next to <B>Other calendars</B>, click <B>+</B>, then <B>From URL</B>.
                </>,
                <>
                  Paste the link and click <B>Add calendar</B>.
                </>,
              ]}
            />
            <OutLink href="https://calendar.google.com/calendar/r/settings/addbyurl">Open Google Calendar</OutLink>
            <p className="text-sm text-muted">
              Google can&apos;t add a calendar by link on a phone, so do it once on a computer. It then shows up in the
              Google Calendar app on your phone too. If it doesn&apos;t, open the app&apos;s <B>Settings</B>, tap the <B>Workouts</B> calendar
              and turn on <B>Sync</B>.
            </p>
            <p className="text-xs text-muted">Google checks for changes every several hours, so edits can take up to a day to appear.</p>
          </>
        )}
        {guide === "outlook" && (
          <>
            <p className="text-sm text-muted">
              Outlook can&apos;t add a calendar from a link on a phone, in the app or in a phone&apos;s browser. Do it once
              on a computer, and it then shows up in the Outlook app on your phone too. Copy the link here, then send it
              to yourself or open this page on the computer.
            </p>
            <Steps
              title="On a computer"
              steps={[
                <>Copy the link above.</>,
                <>
                  Go to <B>outlook.com</B> (personal) or <B>outlook.office.com</B> (work or school) and sign in.
                </>,
                <>
                  Open <B>Calendar</B>, then <B>Add calendar</B> in the left-hand list.
                </>,
                <>
                  Choose <B>Subscribe from web</B>.
                </>,
                <>
                  Paste the link, name it &ldquo;Workouts&rdquo; and click <B>Import</B>.
                </>,
              ]}
            />
            <p className="text-sm text-muted">
              Some workplaces turn off outside calendars; if you can&apos;t find <B>Subscribe from web</B>, that&apos;s probably why.
            </p>
            <p className="text-xs text-muted">Outlook checks for changes every few hours.</p>
          </>
        )}
        {guide === "apple" && (
          <>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">On this iPhone, iPad or Mac</h3>
              <p className="text-sm text-muted">
                Tap the button below, then <B>Subscribe</B> when your device asks.
              </p>
              <OutLink href={webcal}>Subscribe in Calendar</OutLink>
            </div>
            <Steps
              title="Or add it by hand on an iPhone"
              steps={[
                <>Copy the link above.</>,
                <>
                  Open <B>Settings</B>, then <B>Apps</B> → <B>Calendar</B> (on older iOS, just <B>Calendar</B>).
                </>,
                <>
                  Tap <B>Calendar Accounts</B> → <B>Add Account</B> → <B>Other</B> → <B>Add Subscribed Calendar</B>.
                </>,
                <>
                  Paste the link, tap <B>Next</B>, then <B>Save</B>.
                </>,
              ]}
            />
          </>
        )}
        {guide === "other" && (
          <Steps
            steps={[
              <>Copy the link above.</>,
              <>
                In your calendar app, look for <B>Subscribe</B>, <B>Add calendar from URL</B> or <B>Add internet calendar</B>.
              </>,
              <>Paste the link and save.</>,
            ]}
          />
        )}
      </div>
    </Sheet>
  );
}
