import { useColorScheme } from "react-native";

/*
 * Colours from the website (apps/web/app/globals.css), light and dark. React Native has no oklch(),
 * so those are converted to hex.
 */
const light = {
  bg: "#f7f7f5",
  surface: "#ffffff",
  surface2: "#f1f1ee",
  border: "#e4e4df",
  text: "#1c1c1a",
  muted: "#6b6b66",
  accent: "#b3a369",
  accentFg: "#1c1c1a",
  accentInk: "#857437",
  today: "#b3a369",
  danger: "#dc2626",
  warn: "#d97706",
  warnBg: "rgba(217, 119, 6, 0.15)",
  injury: "rgba(220, 38, 38, 0.07)",
  done: "#37b05d",
  doneFg: "#ffffff",
  missed: "#da4b46",
  missedFg: "#ffffff",
  plannedBg: "#e8fbeb",
  plannedFg: "#236436",
  pb: "#f59e0b",
  /** Habit counter colours by level (habitLevel), 0 = none through 6 = most: [background, text]. */
  habit: [
    ["#37b05d", "#ffffff"],
    ["#beecc6", "#174825"],
    ["#f9eda7", "#584503"],
    ["#f5cc58", "#3d2a02"],
    ["#f59d4f", "#401f0a"],
    ["#da4b46", "#ffffff"],
    ["#ac2727", "#ffffff"],
  ] as [string, string][],
};

const dark: typeof light = {
  bg: "#111110",
  surface: "#1a1a18",
  surface2: "#232320",
  border: "#2e2e2a",
  text: "#ededea",
  muted: "#9a9a93",
  accent: "#b3a369",
  accentFg: "#17150e",
  accentInk: "#c4b47c",
  today: "#b3a369",
  danger: "#f87171",
  warn: "#fbbf24",
  warnBg: "rgba(251, 191, 36, 0.15)",
  injury: "rgba(248, 113, 113, 0.09)",
  done: "#2d8949",
  doneFg: "#f0fdf1",
  missed: "#b63b37",
  missedFg: "#fff6f5",
  plannedBg: "#1b2a1f",
  plannedFg: "#95d7a2",
  pb: "#fbbf24",
  habit: [
    ["#2d8949", "#f0fdf1"],
    ["#2c5c38", "#d1f2d7"],
    ["#756a24", "#fdf9e3"],
    ["#a77f19", "#1f1401"],
    ["#c86f25", "#1f0b02"],
    ["#b63b37", "#fff6f5"],
    ["#8a1619", "#ffffff"],
  ],
};

export type Theme = typeof light;

/** The colours for the phone's light or dark mode. */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
