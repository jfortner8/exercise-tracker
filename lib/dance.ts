import type { Workout } from "./types";

/** Dance styles offered when a workout's type is "dance". "other" takes a typed-in name. Optional. */
export const DANCE_STYLES: { key: string; label: string }[] = [
  { key: "salsa", label: "Salsa" },
  { key: "bachata", label: "Bachata" },
  { key: "merengue", label: "Merengue" },
  { key: "cumbia", label: "Cumbia" },
  { key: "kizomba", label: "Kizomba" },
  { key: "zouk", label: "Zouk" },
  { key: "cha-cha", label: "Cha-cha" },
  { key: "rumba", label: "Rumba" },
  { key: "samba", label: "Samba" },
  { key: "tango", label: "Tango" },
  { key: "ballroom", label: "Ballroom" },
  { key: "swing", label: "Swing / Lindy Hop" },
  { key: "west-coast-swing", label: "West Coast Swing" },
  { key: "country", label: "Country / Two-step" },
  { key: "line", label: "Line dancing" },
  { key: "ballet", label: "Ballet" },
  { key: "contemporary", label: "Contemporary" },
  { key: "jazz", label: "Jazz" },
  { key: "tap", label: "Tap" },
  { key: "hip-hop", label: "Hip-hop" },
  { key: "breaking", label: "Breaking" },
  { key: "house", label: "House" },
  { key: "k-pop", label: "K-pop" },
  { key: "pole", label: "Pole" },
  { key: "belly", label: "Belly dance" },
  { key: "bollywood", label: "Bollywood" },
  { key: "flamenco", label: "Flamenco" },
  { key: "irish", label: "Irish" },
  { key: "folk", label: "Folk" },
  { key: "zumba", label: "Zumba" },
  { key: "other", label: "Other" },
];

/** What kind of dance session it was. Optional, like a sport's session. */
export const DANCE_SESSIONS: { key: string; label: string }[] = [
  { key: "practice", label: "Practice" },
  { key: "class", label: "Class" },
  { key: "show", label: "Performance / Show" },
  { key: "social", label: "Social" },
];

type DanceFields = Pick<Workout, "danceStyle" | "danceStyleName" | "danceSession">;

/** "Salsa", or the typed name for "other". */
export function danceStyleName(w: DanceFields): string | undefined {
  if (!w.danceStyle) return undefined;
  if (w.danceStyle === "other") return w.danceStyleName?.trim() || undefined;
  return DANCE_STYLES.find((s) => s.key === w.danceStyle)?.label;
}

/**
 * "Salsa class", "Bachata social", "Dance practice" (no style), "Salsa" (no session);
 * undefined when neither was picked. "Performance / Show" reads as "show".
 */
export function danceCategory(w: DanceFields): string | undefined {
  const style = danceStyleName(w);
  const session = DANCE_SESSIONS.find((s) => s.key === w.danceSession);
  if (!style && !session) return undefined;
  const what = session ? (session.key === "show" ? "show" : session.label.toLowerCase()) : undefined;
  return [style ?? "Dance", what].filter(Boolean).join(" ");
}
