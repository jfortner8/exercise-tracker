import { addDays, format, parseISO } from "date-fns";
import type { Injury } from "./types";

/** How long the Injuries tab stays after an injury heals. */
export const HEALED_TAB_DAYS = 30;

/** Injuries that bother you on `date`: not healed, started by then, and not ended before it. */
export function currentInjuries(injuries: Injury[], date: string): Injury[] {
  return injuries.filter((i) => i.status !== "healed" && i.startDate <= date && (!i.endDate || i.endDate >= date));
}

/**
 * The Injuries tab shows while something is active or recovering, or healed within the last month.
 * Like the other optional tabs, it appears when it's useful and goes away again.
 */
export function showInjuriesTab(injuries: Injury[], today: string): boolean {
  const since = format(addDays(parseISO(today), -HEALED_TAB_DAYS), "yyyy-MM-dd");
  return injuries.some((i) => i.status !== "healed" || (!!i.endDate && i.endDate >= since));
}
