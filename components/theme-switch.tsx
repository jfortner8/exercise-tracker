"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { THEME_KEY as KEY, type Theme } from "@/lib/theme";
import { cx } from "./ui";

const EVENT = "themechange";

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function setAttr(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

/**
 * Re-applies the saved theme before paint. Needed in development, where Strict Mode's remount
 * resets <html> attributes and clears the one THEME_SCRIPT set; a no-op in production.
 */
export function ThemeSync() {
  useLayoutEffect(() => setAttr(read()), []);
  return null;
}

function apply(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // Storage blocked (private mode): still switch for this page view.
  }
  setAttr(t);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    // Another tab changed it: mirror the attribute here too.
    setAttr(read());
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** System / Light / Dark. Saved on this device. `compact` shows icons only (sidebar). */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => apply(value)}
          className={cx(
            "flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors",
            compact ? "p-1.5" : "px-3 py-1",
            theme === value ? "bg-surface-2 text-text" : "text-muted hover:text-text",
          )}
        >
          <Icon className="size-3.5" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
