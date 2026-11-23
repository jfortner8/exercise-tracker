import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import type { AuthSession } from "@et/core/api-types";
import { api, ApiError } from "@/api/client";
import { useSession } from "@/auth/session";
import { Body, Button, ErrorText, Field, Screen, Title } from "@/ui";

/** The emailed code plus a new password; setting it signs straight in. */
export default function Reset() {
  const { signIn } = useSession();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(await api<AuthSession>("/auth/reset", { body: { email, code, password } }));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);
  return (
    <Screen>
      <Title subtitle={`If ${email} has an account, a code is on its way.`}>Set a new password</Title>
      <ErrorText>{error && !error.field ? error.message : null}</ErrorText>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        error={fieldError("code")}
      />
      <Field
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        error={fieldError("password")}
      />
      <Body muted style={{ marginBottom: 8 }}>
        At least 10 characters.
      </Body>
      <Button title="Set password and sign in" onPress={submit} loading={busy} />
    </Screen>
  );
}
