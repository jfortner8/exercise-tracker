import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarFeed } from "@/components/calendar-feed";
import { DeleteAccount } from "@/components/delete-account";
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
      <DeleteAccount />
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
      <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted">
        <p>Exercise Tracker is free and made by one person. If it helps your training, you can chip in.</p>
        {/* Buy Me a Coffee's button as a plain styled link rather than their widget script, so opening Settings loads nothing from their servers. */}
        <a
          href="https://www.buymeacoffee.com/johnfortner"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-black bg-[#ffdd00] px-3 py-1.5 text-sm font-semibold text-black hover:brightness-95"
        >
          <span aria-hidden>☕</span> Buy me a coffee
        </a>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/privacy" className="hover:text-text hover:underline">
          Privacy
        </Link>
      </p>
      {/* Phones have no sidebar (where sign-out lives on wider screens), so it goes here. */}
      <form action="/api/auth/logout" method="post" className="mt-8 border-t border-border pt-6 md:hidden">
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-danger hover:bg-surface-2">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );
}
