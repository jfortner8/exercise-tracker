import { ChevronLeft, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/delete-account";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Account" };

/** Settings → Account: who you're signed in as, signing out, and (tucked away here) deleting the account. */
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl">
      <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Account" />
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="font-medium">{user.email}</p>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </section>
      <DeleteAccount />
    </div>
  );
}
