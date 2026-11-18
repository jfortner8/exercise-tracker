import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutinesEditor } from "@/components/routines/routines-editor";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/dal";
import { listRoutines } from "@/lib/db/repo";

export const metadata: Metadata = { title: "Routines" };

async function Routines() {
  const { user, profile } = await requireProfile();
  return <RoutinesEditor routines={await listRoutines(user.sub)} units={profile.units} />;
}

export default function RoutinesPage() {
  return (
    <div className="max-w-xl">
      <PageHeader
        title="Routines"
        subtitle="Saved exercise lists for Strength workouts. Changes apply the next time you use one; workouts already on the calendar keep their own copy."
      />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Routines />
      </Suspense>
    </div>
  );
}
