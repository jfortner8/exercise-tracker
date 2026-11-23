import type { NavFlags } from "@et/core/nav-flags";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";

export interface TabDef {
  /** The route under (tabs). */
  name: string;
  label: string;
  /** iOS SF Symbol, plain and selected. */
  sf: { default: SFSymbol; selected: SFSymbol };
  /** Android Material Symbol. */
  md: AndroidSymbol;
  /** Optional tabs show once the user has started using the feature, as on the website (NavFlags). */
  flag?: keyof NavFlags;
  /** The website page that does the same, until the app has its own screen. */
  web: string;
}

/** Always in the bar. */
export const MAIN_TABS: TabDef[] = [
  { name: "index", label: "Calendar", sf: { default: "calendar", selected: "calendar" }, md: "calendar_month", web: "/" },
  { name: "benchmarks", label: "PBs", sf: { default: "trophy", selected: "trophy.fill" }, md: "emoji_events", web: "/benchmarks" },
  { name: "leaderboards", label: "Ranks", sf: { default: "list.number", selected: "list.number" }, md: "leaderboard", web: "/leaderboards" },
  { name: "friends", label: "Friends", sf: { default: "person.2", selected: "person.2.fill" }, md: "group", web: "/friends" },
];

export const SETTINGS_TAB: TabDef = {
  name: "settings",
  label: "Settings",
  sf: { default: "gearshape", selected: "gearshape.fill" },
  md: "settings",
  web: "/settings",
};

/** Earned tabs, in the website's order. */
export const OPTIONAL_TABS: TabDef[] = [
  { name: "sports", label: "Sports", sf: { default: "sportscourt", selected: "sportscourt.fill" }, md: "sports_soccer", flag: "showSports", web: "/sports" },
  { name: "weight", label: "Weight", sf: { default: "scalemass", selected: "scalemass.fill" }, md: "monitor_weight", flag: "showWeight", web: "/weight" },
  { name: "routines", label: "Routines", sf: { default: "dumbbell", selected: "dumbbell.fill" }, md: "fitness_center", flag: "showRoutines", web: "/routines" },
  { name: "injuries", label: "Injuries", sf: { default: "bandage", selected: "bandage.fill" }, md: "healing", flag: "showInjuries", web: "/injuries" },
];

export const findTab = (name: string) => [...MAIN_TABS, SETTINGS_TAB, ...OPTIONAL_TABS].find((t) => t.name === name);
