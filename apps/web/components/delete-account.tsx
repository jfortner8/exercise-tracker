"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/lib/actions";
import { Button } from "@/components/ui";

/** Settings' last section: deletes the account and everything in it, after a confirm. */
export function DeleteAccount() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="mt-8 rounded-xl border border-danger/40 p-5">
      <h2 className="text-sm font-semibold">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        Deletes your account and everything in it: workouts, notes, results, friendships and club memberships. This
        can&apos;t be undone.
      </p>
      <Button
        type="button"
        className="mt-4 text-danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete your account and all your data for good? This can't be undone.")) return;
          setError(null);
          start(async () => {
            try {
              await deleteAccountAction();
            } catch {
              setError("Couldn't delete your account. Try again.");
            }
          });
        }}
      >
        <Trash2 className="size-4" /> {pending ? "Deleting…" : "Delete my account"}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
