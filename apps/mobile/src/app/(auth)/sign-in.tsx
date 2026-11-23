import { router } from "expo-router";
import { useState } from "react";
import type { AuthSession } from "@et/core/api-types";
import { api, ApiError } from "@/api/client";
import { setPending } from "@/auth/pending";
import { useSession } from "@/auth/session";
import { Button, ErrorText, Field, Screen, Title } from "@/ui";

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(await api<AuthSession>("/auth/login", { body: { email, password } }));
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "UNCONFIRMED") {
        // The API just sent a fresh code; confirm, then sign in with what was typed here.
        setPending(email, password);
        router.push({ pathname: "/confirm", params: { email } });
      } else setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title subtitle="Sign in to see your training calendar.">Welcome back</Title>
      <ErrorText>{error && !error.field ? error.message : null}</ErrorText>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={error?.field === "email" ? error.message : undefined}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        error={error?.field === "password" ? error.message : undefined}
      />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Button title="Forgot password?" variant="link" onPress={() => router.push({ pathname: "/forgot", params: { email } })} />
      <Button title="New here? Create an account" variant="link" onPress={() => router.push("/sign-up")} />
    </Screen>
  );
}
