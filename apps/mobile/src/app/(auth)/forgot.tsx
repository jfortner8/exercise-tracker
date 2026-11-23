import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { api, ApiError } from "@/api/client";
import { Button, ErrorText, Field, Screen, Title } from "@/ui";

export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot", { body: { email } });
      router.push({ pathname: "/reset", params: { email } });
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title subtitle="We'll email you a code to set a new one.">Forgot your password?</Title>
      <ErrorText>{error && !error.field ? error.message : null}</ErrorText>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={submit}
        error={error?.field === "email" ? error.message : undefined}
      />
      <Button title="Send code" onPress={submit} loading={busy} />
    </Screen>
  );
}
