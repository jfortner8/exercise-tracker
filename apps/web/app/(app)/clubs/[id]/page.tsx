import { format, parseISO } from "date-fns";
import { ArrowLeft, Crown, Medal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClubExit, ClubName, CodeCard, MemberActions } from "@/components/social/social-ui";
import { Card } from "@/components/ui";
import { requireProfile } from "@/lib/dal";
import { ApiError } from "@/lib/api-error";
import { clubDetail } from "@/lib/services/social";

export const metadata: Metadata = { title: "Club" };

async function ClubDetail({ params }: { params: PageProps<"/clubs/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireProfile();
  // Only members can see a club; to anyone else it doesn't exist.
  const { club, members: sorted, isAdmin, heir } = await clubDetail(user.sub, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const members = sorted;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/friends" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Friends &amp; clubs
        </Link>
        <ClubName clubId={club.id} name={club.name} isAdmin={isAdmin} />
        <Link
          href={`/leaderboards?g=${club.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg hover:brightness-110"
        >
          <Medal className="size-4" /> Club leaderboard
        </Link>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Invite code</h2>
        <p className="-mt-2 text-sm text-muted">Anyone with this code can join and see the club&apos;s board.</p>
        <CodeCard
          code={club.code}
          shareText={`Join ${club.name} on Exercise Tracker with code`}
          reset={isAdmin ? { clubId: club.id } : undefined}
          resetConfirm="Make a new invite code? The old one stops working. Members stay in the club."
        />
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Members <span className="font-normal text-muted">{members.length}</span>
        </h2>
        <Card className="divide-y divide-border">
          {sorted.map((m) => (
            <div key={m.sub} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
                {m.displayName.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {m.displayName}
                  {m.sub === user.sub && <span className="ml-1.5 text-xs font-normal text-accent-ink">You</span>}
                </span>
                <span className="block text-xs text-muted">
                  {m.sub === club.adminSub && (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 text-accent-ink">
                      <Crown className="size-3" /> Admin ·
                    </span>
                  )}
                  Joined {format(parseISO(m.joinedAt), "MMM d, yyyy")}
                </span>
              </span>
              {isAdmin && m.sub !== user.sub && <MemberActions clubId={club.id} sub={m.sub} name={m.displayName} />}
            </div>
          ))}
        </Card>
      </section>

      <section className="border-t border-border pt-5">
        <ClubExit
          clubId={club.id}
          clubName={club.name}
          isAdmin={isAdmin}
          heirName={heir?.displayName ?? null}
        />
        {isAdmin && heir && (
          <p className="mt-2 text-xs text-muted">
            If you leave, admin passes to {heir.displayName}, the longest-standing member.
            Or hand it to someone with Make admin.
          </p>
        )}
      </section>
    </div>
  );
}

export default function ClubPage({ params }: PageProps<"/clubs/[id]">) {
  return (
    <div className="max-w-xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
        <ClubDetail params={params} />
      </Suspense>
    </div>
  );
}
