import { Activity } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const WEEK = [
  { d: "Mon", label: "Easy run", state: "done" },
  { d: "Tue", label: "Strength", state: "done" },
  { d: "Wed", label: "Long run", state: "done" },
  { d: "Thu", label: "Swim", state: "today" },
  { d: "Fri", label: "Intervals", state: "planned" },
  { d: "Sat", label: "Stretch", state: "planned" },
  { d: "Sun", label: "Rest", state: "planned" },
] as const;

/** Split auth layout: brand panel (desktop) + form column. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-[#15140f] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, rgba(179,163,105,.45), transparent 70%), radial-gradient(50% 40% at 90% 90%, rgba(234,170,0,.22), transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-[#b3a369] text-[#17150e]">
            <Activity className="size-4" />
          </span>
          Exercise Tracker
        </div>

        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            See what you planned.
            <br />
            <span className="text-[#d6c99a]">Log what you did.</span>
          </h2>
          <p className="mt-4 text-white/70">
            A training calendar that keeps your plan and your reality side by side, plus injuries, notes, and
            personal bests.
          </p>

          <div className="mt-10 grid grid-cols-7 gap-1.5" aria-hidden>
            {WEEK.map((w) => (
              <div key={w.d} className="flex flex-col gap-1.5">
                <span className="text-center text-[11px] uppercase tracking-wide text-white/50">{w.d}</span>
                <div
                  className={
                    "flex h-16 items-end rounded-lg p-1.5 text-[10px] font-medium leading-tight " +
                    (w.state === "done"
                      ? "bg-[#b3a369] text-[#17150e]"
                      : w.state === "today"
                        ? "border border-[#d6c99a] bg-[#b3a369]/15 text-[#efe8cf] ring-2 ring-[#b3a369]/40"
                        : "border border-dashed border-white/30 text-white/70")
                  }
                >
                  {w.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg">
            <Activity className="size-4" />
          </span>
          Exercise Tracker
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          <p className="mt-6 text-center text-xs text-muted">
            <Link href="/privacy" className="hover:text-text hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
