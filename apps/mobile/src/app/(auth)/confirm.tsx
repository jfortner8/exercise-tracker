import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import type { AuthSession } from "@et/core/api-types";
import { api, ApiError } from "@/api/client";
import { clearPending, getPending } from "@/auth/pending";
import { useSession } from "@/auth/session";
import { Body, Button, ErrorText, Field, Screen, Title } from "@/ui";

/** The code Cognito emailed after sign-up. Confirming signs straight in with the password just typed. */
export default function Confirm() {
  const { signIn } = useSession();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const pending = getPending();
    if (!pending || pending.email !== email) {
      // The app was closed in between, so the password is gone: confirm by signing in again.
      router.replace("/sign-in");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api<AuthSession>("/auth/confirm", { body: { ...pending, code } });
      clearPending();
      await signIn(session);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api("/auth/resend", { body: { email } });
      setNote("A new code is on its way.");
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <Screen>
      <Title subtitle={`We sent a code to ${email}.`}>Check your email</Title>
      <ErrorText>{error && error.field !== "code" ? error.message : null}</ErrorText>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={submit}
        error={error?.field === "code" ? error.message : undefined}
      />
      <Button title="Confirm and sign in" onPress={submit} loading={busy} />
      {note ? <Body muted>{note}</Body> : null}
      <Button title="Send a new code" variant="link" onPress={resend} />
    </Screen>
  );
}
