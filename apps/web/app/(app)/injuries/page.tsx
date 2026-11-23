import type { Metadata } from "next";
import { Suspense } from "react";
import { InjuryList } from "@/components/injuries";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { injuriesWithPain } from "@/lib/services/injuries";

export const metadata: Metadata = { title: "Injuries" };

async function Injuries() {
  const { sub } = await requireUser();
  const { injuries, pain } = await injuriesWithPain(sub);
  return <InjuryList injuries={injuries} pain={pain} />;
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
