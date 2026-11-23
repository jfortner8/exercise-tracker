import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Exercise Tracker stores, who can see it, and how to delete it.",
};

/** Shown under "Questions" when set. Left out until there's an address to publish. */
const CONTACT_EMAIL: string | null = null;
const UPDATED = "November 23, 2026";

/** The privacy policy, for the website and the app store listings. Public: no sign-in needed (proxy.ts). */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg">
          <Activity className="size-4" />
        </span>
        Exercise Tracker
      </Link>

      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}. This covers the website and the phone app.</p>

      <p className="mt-6">
        Exercise Tracker keeps your training plan and log. It stores what you enter so it can show it back to you, and
        the people you choose. It has no ads, sells nothing about you, and runs no analytics or tracking scripts.
      </p>

      <Section title="What it stores">
        <List>
          <li>
            <b>Your account:</b> your email address and the name you choose. Passwords are handled by Amazon Cognito,
            which stores them securely; Exercise Tracker itself never stores your password.
          </li>
          <li>
            <b>Your training:</b> workouts you plan and log (with any times, distances, exercises, heart rate, effort and
            notes), day notes, the habit counters and goals you turn on, bodyweight if you turn on weight tracking,
            injuries and pain levels, benchmarks and results, and saved routines.
          </li>
          <li>
            <b>Settings:</b> units, week start, clock, your time zone (so &ldquo;today&rdquo; and start times are right
            where you are), and who can see your personal bests.
          </li>
          <li>
            <b>Friends and clubs:</b> who you&apos;re friends with, the clubs you&apos;re in, and your invite codes.
          </li>
          <li>
            <b>To stop abuse:</b> your IP address and the email address you sign in with are counted briefly to limit
            repeated sign-in attempts. These counts delete themselves within about 20 minutes. Wrong friend and club
            codes are counted per day for the same reason.
          </li>
        </List>
      </Section>

      <Section title="Who can see it">
        <List>
          <li>You. Everything you enter is private to your account unless something below applies.</li>
          <li>
            <b>Leaderboards:</b> your name and your bests on the built-in benchmarks are shown to the people you pick in
            Settings: nobody, your friends and clubs, or everyone. Your consistency (days on track) is shown to friends
            and clubs only if you turn it on.
          </li>
          <li>
            <b>Friends and clubs</b> see your name. Club members see who else is in the club.
          </li>
          <li>
            <b>Calendar feed:</b> if you turn it on, anyone with its private link can see your workouts in a calendar
            app. Reset the link or turn the feed off in Settings at any time.
          </li>
        </List>
        <p className="mt-3">Nothing is sold, shared with advertisers, or used to train anything.</p>
      </Section>

      <Section title="Where it's kept">
        <p>
          Your data is stored with Amazon Web Services in the United States (DynamoDB for your data, Cognito for
          sign-in), and the website runs on Vercel. It&apos;s encrypted in transit and at rest. Backups are kept for up
          to 35 days so data can be recovered after a mistake. Amazon Cognito sends the sign-up and password-reset
          emails.
        </p>
      </Section>

      <Section title="Cookies and storage">
        <p>
          The website sets two cookies: one that keeps you signed in, and one with your device&apos;s time zone. Your
          light or dark theme is saved in your browser. The phone app keeps its sign-in in the phone&apos;s secure
          storage. There are no tracking or advertising cookies.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          Delete your account in Settings, on the website or in the app. That deletes everything: your profile, every
          workout and note, your results and leaderboard entries, your friendships (on both sides), your club
          memberships, your invite codes and calendar link, and your sign-in. A club you were the last member of is
          deleted; otherwise its admin role passes to the longest-standing member. Copies in backups age out within 35
          days.
        </p>
      </Section>

      <Section title="Children">
        <p>Exercise Tracker isn&apos;t meant for children under 13, and doesn&apos;t knowingly collect their data.</p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, the new version is posted here with a new date.</p>
      </Section>

      {CONTACT_EMAIL && (
        <Section title="Questions">
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent-ink hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 leading-relaxed text-text/90">{children}</div>
    </section>
  );
}

const List = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-2 pl-5 leading-relaxed">{children}</ul>;
