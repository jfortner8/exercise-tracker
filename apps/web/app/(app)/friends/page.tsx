import { format, parseISO } from "date-fns";
import { ChevronRight, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CodeCard, CreateClub, JoinWithCode, RemoveFriendButton } from "@/components/social/social-ui";
import { Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/dal";
import { socialOverview } from "@/lib/services/social";

export const metadata: Metadata = { title: "Friends & clubs" };

async function FriendsAndClubs() {
  const { user, profile } = await requireProfile();
  const { friendCode: code, friends, clubs } = await socialOverview(user.sub, profile);

  return (
    <div className="space-y-6">
      {profile.share === "off" && (
        <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
          Your PBs are hidden from everyone, friends and clubs included.{" "}
          <Link href="/settings" className="font-medium text-accent-ink hover:underline">
            Change who sees them in Settings
          </Link>
          .
        </div>
      )}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Add a friend or join a club</h2>
        <p className="-mt-2 text-sm text-muted">Enter the code someone gave you.</p>
        <JoinWithCode />
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Your friend code</h2>
        <p className="-mt-2 text-sm text-muted">
          Anyone who enters it becomes your friend, and you both see each other on your Friends boards.
        </p>
        <CodeCard
          code={code}
          shareText="Add me as a friend on Exercise Tracker with my code"
          reset="friend"
          resetConfirm="Make a new friend code? The old one stops working. Your current friends stay friends."
        />
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Friends <span className="font-normal text-muted">{friends.length}</span>
        </h2>
        {friends.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No friends yet. Send your code, or enter theirs above.
          </p>
        ) : (
          <Card className="divide-y divide-border">
            {friends.map((f) => (
              <div key={f.sub} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
                  {f.displayName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.displayName}</span>
                  <span className="block text-xs text-muted">Friends since {format(parseISO(f.since), "MMM d, yyyy")}</span>
                </span>
                <RemoveFriendButton sub={f.sub} name={f.displayName} />
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Clubs <span className="font-normal text-muted">{clubs.length}</span>
          </h2>
        </div>
        <p className="mb-3 text-sm text-muted">Everyone in a club sees the same leaderboard. Join one with its code above.</p>
        {clubs.length > 0 && (
          <Card className="mb-3 divide-y divide-border">
            {clubs.map(({ club, memberCount: count, isAdmin }) => (
              <Link key={club.id} href={`/clubs/${club.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{club.name}</span>
                  <span className="block text-xs text-muted">
                    {count} {count === 1 ? "member" : "members"}
                    {isAdmin && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-accent-ink">
                        <Crown className="size-3" /> Admin
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            ))}
          </Card>
        )}
        <CreateClub />
      </section>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Friends & clubs" subtitle="Compare PBs with people you know." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
        <FriendsAndClubs />
      </Suspense>
    </div>
  );
}
