import { Redirect, useLocalSearchParams } from "expo-router";
import { useSession } from "@/auth/session";
import { ComingSoon } from "@/screens/ComingSoon";
import { OPTIONAL_TABS } from "@/screens/tabs";

/** Android's way into the optional tabs (its tab bar holds five): Settings links here. */
export default function MoreScreen() {
  const { screen } = useLocalSearchParams<{ screen: string }>();
  const tab = OPTIONAL_TABS.find((t) => t.name === screen);
  if (useSession().status !== "signedIn") return <Redirect href="/sign-in" />;
  if (!tab) return <Redirect href="/settings" />;
  return <ComingSoon tab={tab} header />;
}
