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
  danger: "#dc2626",
  done: "#37b05d",
  missed: "#da4b46",
  plannedBg: "#e8fbeb",
  plannedFg: "#236436",
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
  danger: "#f87171",
  done: "#2d8949",
  missed: "#b63b37",
  plannedBg: "#1b2a1f",
  plannedFg: "#95d7a2",
};

export type Theme = typeof light;

/** The colours for the phone's light or dark mode. */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
