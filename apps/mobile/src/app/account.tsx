import { Redirect } from "expo-router";
import { useState } from "react";
import type { DeleteAccountResponse } from "@et/core/api-types";
import { api, ApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { Body, Button, Card, ErrorText, Screen } from "@/ui";
import { ask } from "@/ui/confirm";

/** Settings → Account: who you're signed in as, signing out, and (tucked away here) deleting the account. */
export default function Account() {
  const { status, signOut } = useSession();
  const me = useMe(status === "signedIn");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== "signedIn") return <Redirect href="/sign-in" />;

  async function deleteAccount() {
    const sure = await ask(
      "Delete your account?",
      "This deletes your account and everything in it: workouts, notes, results, friendships and club memberships. It can't be undone.",
      "Delete account",
      true,
    );
    if (!sure) return;
    setDeleting(true);
    setError(null);
    try {
      await api<DeleteAccountResponse>("/me", { method: "DELETE", body: { confirm: true } });
      await signOut();
    } catch (e) {
      setError((e as ApiError).message);
      setDeleting(false);
    }
  }

  return (
    <Screen header>
      {me.data && (
        <Card>
          <Body muted>Signed in as</Body>
          <Body style={{ fontWeight: "600" }}>{me.data.user.email}</Body>
          <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
        </Card>
      )}
      <Card>
        <Body style={{ fontWeight: "600", marginBottom: 4 }}>Delete account</Body>
        <Body muted>
          Deletes your account and everything in it: workouts, notes, results, friendships and club memberships. This can&apos;t be
          undone.
        </Body>
        <Button title="Delete my account" variant="danger" onPress={() => void deleteAccount()} loading={deleting} />
        <ErrorText>{error}</ErrorText>
      </Card>
    </Screen>
  );
}
