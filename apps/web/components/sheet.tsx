"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cx } from "./ui";

/** Right-side drawer on desktop, bottom sheet on mobile. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  variant = "drawer",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  variant?: "drawer" | "dialog";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={cx(
          "relative ml-auto flex max-h-dvh w-full flex-col bg-surface shadow-2xl",
          variant === "drawer"
            ? "mt-auto max-h-[92dvh] rounded-t-2xl sm:mt-0 sm:h-dvh sm:max-h-dvh sm:max-w-lg sm:rounded-none sm:border-l sm:border-border"
            : "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border",
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
