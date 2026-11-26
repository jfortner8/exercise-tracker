import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ApiError } from "@/api/client";
import { cacheStorage } from "@/api/storage";
import { SessionProvider, useSession } from "@/auth/session";
import { OutboxSync } from "@/screens/SyncNote";
import { useTheme } from "@/theme";
import { restoreTheme } from "@/theme-pref";
import { configureNotifications } from "@/reminders";

SplashScreen.preventAutoHideAsync().catch(() => {});
void restoreTheme();
if (Platform.OS !== "web") configureNotifications();

const WEEK = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Kept a week, so the app opens on the last data it saw (offline too) and refreshes behind it.
      gcTime: WEEK,
      staleTime: 30_000,
      // A 4xx won't change by asking again; network trouble and 5xx get two more tries.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

const persister = createAsyncStoragePersister({ storage: cacheStorage, key: "query-cache" });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: WEEK, buster: "v1" }}>
        <SessionProvider>
          <Navigator />
        </SessionProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Signed in: the tabs. Signed out: sign-in and its friends. The splash stays up until we know which. */
function Navigator() {
  const { status } = useSession();
  const t = useTheme();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);
  if (status === "loading") return null;
  return (
    <>
      <StatusBar style="auto" />
      {status === "signedIn" && <OutboxSync />}
      {/* Each group's layout redirects to the other when it's the wrong side of signed in. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="more/[screen]" options={{ headerShown: true, headerTitle: "", headerBackTitle: "Settings" }} />
        <Stack.Screen
          name="day/[date]"
          options={{ headerShown: true, presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }}
        />
        <Stack.Screen name="workout" options={{ headerShown: true, presentation: "modal" }} />
        <Stack.Screen name="club/[id]" options={{ headerShown: true, headerBackTitle: "Friends" }} />
        <Stack.Screen name="benchmark/[id]" options={{ headerShown: true, headerBackTitle: "PBs" }} />
        <Stack.Screen name="account" options={{ headerShown: true, headerTitle: "Account", headerBackTitle: "Settings" }} />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  );
}
