import { Redirect, Stack } from "expo-router";
import { useSession } from "@/auth/session";
import { useTheme } from "@/theme";

export const unstable_settings = { initialRouteName: "sign-in" };

export default function AuthLayout() {
  const t = useTheme();
  if (useSession().status === "signedIn") return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerTitle: "",
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: t.accentInk,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
