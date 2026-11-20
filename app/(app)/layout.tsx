import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { BottomNav, Sidebar } from "@/components/nav";
import { ThemeSwitch } from "@/components/theme-switch";
import { ZoneSync } from "@/components/zone-sync";
import { requireProfile, requireToday } from "@/lib/dal";
import { listInjuries } from "@/lib/db/repo";
import { showInjuriesTab } from "@/lib/injuries";

async function UserFooter() {
  const { profile, user } = await requireProfile();
  return (
    <div className="flex items-center gap-2 border-t border-border px-2 pt-4">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
        {profile.displayName.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{profile.displayName}</div>
        <div className="truncate text-xs text-muted">{user.email}</div>
      </div>
      <form action="/api/auth/logout" method="post">
        <button title="Sign out" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

const sidebarFooter = (
  <>
    <div className="mb-3 px-2">
      <ThemeSwitch compact />
    </div>
    <Suspense fallback={<div className="h-12" />}>
      <UserFooter />
    </Suspense>
  </>
);

async function Zone() {
  const { profile } = await requireProfile();
  return <ZoneSync profileZone={profile.timeZone} />;
}

/** Nav with the optional tabs: Sports (after a completed sport workout) and Weight (when tracking it). */
async function Nav({ part }: { part: "sidebar" | "bottom" }) {
  const { user, profile } = await requireProfile();
  const flags = {
    showSports: profile.hasSports === true,
    showWeight: profile.trackWeight,
    showRoutines: profile.hasRoutines === true,
    showInjuries: showInjuriesTab(await listInjuries(user.sub), await requireToday()),
  };
  return part === "sidebar" ? <Sidebar footer={sidebarFooter} {...flags} /> : <BottomNav {...flags} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<Sidebar footer={sidebarFooter} />}>
        <Nav part="sidebar" />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      <Suspense fallback={<BottomNav />}>
        <Nav part="bottom" />
      </Suspense>
      <Suspense fallback={null}>
        <Zone />
      </Suspense>
    </div>
  );
}
