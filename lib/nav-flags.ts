/** Which optional tabs a user has earned. They appear as the user starts using each feature. */
export interface NavFlags {
  /** Has completed a sport workout. */
  showSports?: boolean;
  /** Has bodyweight tracking turned on. */
  showWeight?: boolean;
  /** Has at least one saved strength routine. */
  showRoutines?: boolean;
}

/** Phones fit 7 tabs; with every optional tab on, Injuries moves to the top of Settings instead. */
export const phoneHidesInjuries = (f: NavFlags) => !!(f.showSports && f.showWeight && f.showRoutines);
