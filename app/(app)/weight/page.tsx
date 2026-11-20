import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { WeightTrend } from "@/components/weight-trend";
import { requireProfile, requireToday } from "@/lib/dal";
import { listAllDays } from "@/lib/db/repo";
import { weightSeries } from "@/lib/weight";

export const metadata: Metadata = { title: "Weight" };

async function Trend() {
  const { user, profile } = await requireProfile();
  if (!profile.trackWeight) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
        Bodyweight tracking is off.{" "}
        <Link href="/settings" className="font-medium text-accent-ink hover:underline">
          Turn on &ldquo;Track bodyweight&rdquo; in Settings
        </Link>{" "}
        to log a weight each day.
      </p>
    );
  }
  const series = weightSeries(await listAllDays(user.sub));
  if (!series.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
        No weigh-ins yet. Open a day on the calendar and enter your weight under Day notes.
      </p>
    );
  }
  return <WeightTrend series={series} units={profile.units} today={await requireToday()} />;
}

export default function WeightPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Weight" subtitle="Your bodyweight over time, smoothed with a 7-day average." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
        <Trend />
      </Suspense>
    </div>
  );
}
