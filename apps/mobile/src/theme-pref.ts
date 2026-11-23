import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { cacheStorage as Storage } from "@/api/storage";

/** Light, dark, or follow the phone. Saved on this device only, as on the website. */
export type ThemePref = "system" | "light" | "dark";
const KEY = "theme";

function apply(p: ThemePref) {
  // "unspecified" hands the choice back to the phone.
  Appearance.setColorScheme(p === "system" ? ("unspecified" as "light") : p);
}

/** At launch: put back the saved choice. */
export async function restoreTheme() {
  try {
    const p = (await Storage.getItem(KEY)) as ThemePref | null;
    if (p === "light" || p === "dark") apply(p);
  } catch {}
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    Storage.getItem(KEY)
      .then((p) => p === "light" || p === "dark" ? setPref(p) : undefined)
      .catch(() => {});
  }, []);
  return [
    pref,
    (p) => {
      setPref(p);
      apply(p);
      Storage.setItem(KEY, p).catch(() => {});
    },
  ];
}
