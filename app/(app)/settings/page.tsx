import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/dal";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const { profile } = await requireProfile();
  return <SettingsForm profile={profile} />;
}

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="These apply only to your account." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Settings />
      </Suspense>
    </div>
  );
}
