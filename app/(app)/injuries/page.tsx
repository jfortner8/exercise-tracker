import type { Metadata } from "next";
import { Suspense } from "react";
import { InjuryList } from "@/components/injuries";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { listInjuries, listWorkoutsForInjury } from "@/lib/db/repo";

export const metadata: Metadata = { title: "Injuries" };

async function Injuries() {
  const { sub } = await requireUser();
  const injuries = await listInjuries(sub);
  const pain = await Promise.all(
    injuries.map(async (i) => {
      const ws = await listWorkoutsForInjury(sub, i.id);
      return [
        i.id,
        ws
          .filter((w) => w.painLevel != null)
          .map((w) => ({ date: w.date, level: w.painLevel!, title: w.title }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      ] as const;
    }),
  );
  return <InjuryList injuries={injuries} pain={Object.fromEntries(pain)} />;
}

export default function InjuriesPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Injuries"
        subtitle="Track how long something has bothered you. Link workouts to an injury to see pain levels over time."
      />
      <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-surface-2" />}>
        <Injuries />
      </Suspense>
    </div>
  );
}
