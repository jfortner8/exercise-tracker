import "server-only";
import { profileInput, timeZoneName } from "@et/core/schemas";
import { validTimeZone } from "@et/core/domain";
import { activeGoals, cleanGoals } from "@et/core/goals";
import { HABIT_SINCE_FIRST_DAY, profileHabits, type HabitKind } from "@et/core/habits";
import * as repo from "@/lib/db/repo";
import { syncLeaderboard } from "@/lib/leaderboard";
import type { Clock, Share, Units } from "@et/core/types";
import { syncAfterChange } from "./sync";

/*
 * The profile: settings and the time zone that follows the user.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

/**
 * The browser reports its time zone when it differs from the profile's (the user is travelling, or
 * moved). Saving it keeps the calendar feed's start times, the Consistency board and habit starts on
 * the user's local day.
 */
export async function syncTimeZone(sub: string, timeZone: string) {
  const tz = timeZoneName.parse(timeZone);
  if (!validTimeZone(tz)) return;
  const profile = await repo.getProfile(sub);
  if (!profile || profile.timeZone === tz) return;
  // Older start times were entered in the old zone: pin them there before it moves.
  if (validTimeZone(profile.timeZone)) await repo.stampStartZones(sub, profile.timeZone);
  await repo.setTimeZone(sub, tz);
  // "Today" may have moved a day, which changes which days the Consistency board counts.
  await syncAfterChange(sub);
}

export async function saveProfile(sub: string, email: string, raw: {
  displayName: string;
  units: Units;
  weekStartsOn: 0 | 1;
  clock: Clock;
  habits: HabitKind[];
  habitOnCalendar?: HabitKind;
  goals: { id: string; name: string; emoji?: string; off?: boolean }[];
  goalOnCalendar?: string;
  share: Share;
  shareConsistency?: boolean;
  trackWeight: boolean;
  timeZone?: string;
}) {
  const p = profileInput.parse(raw);
  const existing = await repo.getProfile(sub);
  const habits = profileHabits({ habits: p.habits });
  // A counter's start is the first day it was turned on; turning it off and on again keeps it.
  const habitStarts = { ...existing?.habitStarts };
  const wasOn = existing ? profileHabits(existing) : [];
  // "Today" where the user is (the server runs in UTC); en-CA formats as YYYY-MM-DD.
  const tz = validTimeZone(p.timeZone) ? p.timeZone : validTimeZone(existing?.timeZone) ? existing.timeZone : "UTC";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  // Counters already on with no start (alcohol from the old "Track drinks") count from the first day.
  for (const k of wasOn) habitStarts[k] ??= HABIT_SINCE_FIRST_DAY;
  for (const k of habits) habitStarts[k] ??= today;
  const goals = cleanGoals(p.goals, existing?.goals, today);
  if (validTimeZone(existing?.timeZone) && validTimeZone(p.timeZone) && p.timeZone !== existing.timeZone) {
    await repo.stampStartZones(sub, existing.timeZone);
  }
  // Keep internal fields that aren't part of the settings form.
  await repo.saveProfile(sub, {
    ...p,
    goals,
    // Consistency only goes to people who can see your PBs; off when you share with nobody.
    shareConsistency: p.share !== "off" && p.shareConsistency === true,
    goalOnCalendar: activeGoals({ goals }).some((g) => g.id === p.goalOnCalendar) ? p.goalOnCalendar : activeGoals({ goals })[0]?.id,
    habits,
    habitOnCalendar: p.habitOnCalendar && habits.includes(p.habitOnCalendar) ? p.habitOnCalendar : habits[0],
    habitStarts,
    trackDrinks: habits.includes("alcohol"),
    email,
    timeZone: validTimeZone(p.timeZone) ? p.timeZone : existing?.timeZone,
    hasSports: existing?.hasSports,
    hasRoutines: existing?.hasRoutines,
    friendCode: existing?.friendCode,
    calendarToken: existing?.calendarToken,
    calendarIncludeNotes: existing?.calendarIncludeNotes,
    calendarPlannedOnly: existing?.calendarPlannedOnly,
  });
  // Opting in/out or renaming changes what others see on leaderboards.
  await syncLeaderboard(sub);
  if (existing && existing.displayName !== p.displayName) await repo.updateSocialName(sub, p.displayName);
  await syncAfterChange(sub);
}
