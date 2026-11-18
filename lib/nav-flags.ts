/** Which optional tabs a user has earned. They appear as the user starts using each feature. */
export interface NavFlags {
  /** Has completed a sport workout. */
  showSports?: boolean;
  /** Has bodyweight tracking turned on. */
  showWeight?: boolean;
  /** Has at least one saved strength routine. */
  showRoutines?: boolean;
  /** Has a current injury, or one that healed recently (see showInjuriesTab). */
  showInjuries?: boolean;
}

/** Tabs a phone's bottom bar holds; past this, the last ones go under "More". */
export const PHONE_TABS = 7;

/**
 * The phone bar's tabs, and what goes under "More" when they don't all fit:
 * the first few tabs, then More, then Settings (which always stays in the bar).
 */
export function splitPhoneTabs<T extends { href: string }>(
  items: T[],
  max = PHONE_TABS,
): { bar: T[]; more: T[]; after: T[] } {
  if (items.length <= max) return { bar: items, more: [], after: [] };
  const after = items.filter((i) => i.href === "/settings");
  const rest = items.filter((i) => i.href !== "/settings");
  const room = max - 1 - after.length; // one slot for More
  return { bar: rest.slice(0, room), more: rest.slice(room), after };
}
