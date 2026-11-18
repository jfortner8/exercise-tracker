"use client";

import { Activity, CalendarDays, Dumbbell, HeartPulse, Medal, Scale, Settings, Trophy, Users, Volleyball } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { phoneHidesInjuries, type NavFlags } from "@/lib/nav-flags";
import { cx } from "./ui";

export type { NavFlags };

/**
 * `short` is the label in the phone's bottom bar, where up to seven tabs share the width.
 * `desktopOnly` items skip that bar (phones reach them from another page); `also` lists
 * other paths that highlight the item.
 */
type NavItem = { href: string; label: string; short?: string; icon: typeof Trophy; desktopOnly?: boolean; also?: string[] };
const BASE: NavItem[] = [
  { href: "/", label: "Calendar", icon: CalendarDays },
  { href: "/benchmarks", label: "Benchmarks", short: "PBs", icon: Trophy },
  { href: "/leaderboards", label: "Leaderboards", short: "Ranks", icon: Medal },
  // Phones get here from the Leaderboards page, so the bottom bar doesn't grow.
  { href: "/friends", label: "Friends & clubs", icon: Users, desktopOnly: true, also: ["/clubs"] },
  { href: "/injuries", label: "Injuries", icon: HeartPulse },
  { href: "/settings", label: "Settings", icon: Settings },
];
const SPORTS_ITEM: NavItem = { href: "/sports", label: "Sports", icon: Volleyball };
const WEIGHT_ITEM: NavItem = { href: "/weight", label: "Weight", icon: Scale };
const ROUTINES_ITEM: NavItem = { href: "/routines", label: "Routines", icon: Dumbbell };

/** Optional tabs only show for people who use them, so the menu grows as they find their footing. */
const navItems = ({ showSports, showWeight, showRoutines }: NavFlags): NavItem[] => [
  ...BASE.slice(0, 4), // Calendar, Benchmarks, Leaderboards, Friends & clubs
  ...(showSports ? [SPORTS_ITEM] : []),
  ...(showWeight ? [WEIGHT_ITEM] : []),
  ...(showRoutines ? [ROUTINES_ITEM] : []),
  ...BASE.slice(4),
];

const matches = (path: string | null, href: string, also: string[] = []) =>
  path != null && (href === "/" ? path === "/" : [href, ...also].some((h) => path.startsWith(h)));

/** usePathname is request data, so links render statically first and pick up the active state in a Suspense boundary. */
function WithPath({ children }: { children: (path: string | null) => ReactNode }) {
  return <Suspense fallback={children(null)}><PathReader>{children}</PathReader></Suspense>;
}
function PathReader({ children }: { children: (path: string | null) => ReactNode }) {
  return children(usePathname());
}

export function Sidebar({ footer, ...flags }: { footer: ReactNode } & NavFlags) {
  const ITEMS = navItems(flags);
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg">
          <Activity className="size-4" />
        </span>
        Exercise Tracker
      </Link>
      <WithPath>{(path) => <nav className="flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, icon: Icon, also }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              matches(path, href, also) ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>}</WithPath>
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}

export function BottomNav(flags: NavFlags) {
  // With every optional tab on, Injuries moves to the top of Settings so the bar keeps 7 tabs.
  const ITEMS = navItems(flags).filter((i) => !i.desktopOnly && !(i.href === "/injuries" && phoneHidesInjuries(flags)));
  return <WithPath>{(path) => (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))` }}
    >
      {ITEMS.map(({ href, label, short, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cx(
            "flex min-w-0 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
            matches(path, href) ? "text-accent-ink" : "text-muted",
          )}
        >
          <Icon className="size-5" />
          <span className="max-w-full truncate px-0.5">{short ?? label}</span>
        </Link>
      ))}
    </nav>
  )}</WithPath>;
}
