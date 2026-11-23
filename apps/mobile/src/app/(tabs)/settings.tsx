import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Platform } from "react-native";
import type { DeleteAccountResponse } from "@et/core/api-types";
import { api, ApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { API_URL } from "@/config";
import { OPTIONAL_TABS } from "@/screens/tabs";
import { Body, Button, Card, ErrorText, Screen, Title } from "@/ui";

/**
 * The account for now: who's signed in, the optional screens (Android), privacy, sign out and
 * delete. The full settings form (units, habits, goals, sharing, calendar feed) comes later.
 */
export default function Settings() {
  const me = useMe();
  const { signOut } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const flags = me.data?.navFlags ?? {};
  const earned = Platform.OS === "android" ? OPTIONAL_TABS.filter((t) => t.flag && flags[t.flag]) : [];

  async function deleteAccount() {
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

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This deletes your account and everything in it: workouts, notes, results, friendships and club memberships. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void deleteAccount() },
      ],
    );
  }

  return (
    <Screen onRefresh={() => void me.refetch()} refreshing={me.isRefetching}>
      <Title>Settings</Title>
      <ErrorText>{error ?? me.error?.message}</ErrorText>
      <Card>
        <Body style={{ fontWeight: "600" }}>{me.data?.profile.displayName ?? " "}</Body>
        <Body muted>{me.data?.user.email ?? " "}</Body>
      </Card>

      {earned.length > 0 && (
        <Card>
          {earned.map((t) => (
            <Button key={t.name} title={t.label} variant="secondary" onPress={() => router.push({ pathname: "/more/[screen]", params: { screen: t.name } })} />
          ))}
        </Card>
      )}

      <Card>
        <Body muted>Units, habits, goals, sharing and the calendar feed are on the website for now.</Body>
        <Button title="Open settings on the website" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/settings`)} />
        <Button title="Privacy" variant="link" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={deleting} />
    </Screen>
  );
}
