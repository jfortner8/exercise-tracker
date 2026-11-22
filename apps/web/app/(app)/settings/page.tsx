import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarFeed } from "@/components/calendar-feed";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/dal";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const { profile } = await requireProfile();
  return (
    <>
      <SettingsForm profile={profile} />
      <CalendarFeed profile={profile} />
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="These apply only to your account." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Settings />
      </Suspense>
      {/* Phones have no sidebar (where sign-out lives on wider screens), so it goes here. */}
      <form action="/api/auth/logout" method="post" className="mt-8 border-t border-border pt-6 md:hidden">
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-danger hover:bg-surface-2">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );
}
