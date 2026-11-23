import { router } from "expo-router";
import { useState } from "react";
import { api, ApiError } from "@/api/client";
import { setPending } from "@/auth/pending";
import { Body, Button, ErrorText, Field, Screen, Title } from "@/ui";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/signup", { body: { name, email, password } });
      setPending(email, password);
      router.push({ pathname: "/confirm", params: { email } });
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);
  return (
    <Screen>
      <Title subtitle="We'll email you a code to confirm your address.">Create an account</Title>
      <ErrorText>{error && !error.field ? error.message : null}</ErrorText>
      <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={fieldError("name")} />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={fieldError("email")}
      />
      <Field
        label="Password"
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
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
