import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { MAIN_TABS, OPTIONAL_TABS, SETTINGS_TAB, type TabDef } from "@/screens/tabs";
import { useTheme } from "@/theme";

/**
 * The system tab bar: Liquid Glass on iOS 26, Material on Android. Optional tabs appear once earned
 * (GET /me's navFlags). iOS moves anything past five into its own "More" tab; Android's bar holds
 * five, so there the optional ones open from Settings instead.
 */
export default function TabsLayout() {
  const t = useTheme();
  const signedIn = useSession().status === "signedIn";
  const flags = useMe(signedIn).data?.navFlags ?? {};
  if (!signedIn) return <Redirect href="/sign-in" />;
  const optionalInBar = Platform.OS === "ios";
  const trigger = (tab: TabDef, hidden = false) => (
    <NativeTabs.Trigger key={tab.name} name={tab.name} hidden={hidden}>
      <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
      <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  );
  return (
    <NativeTabs tintColor={t.accentInk}>
      {MAIN_TABS.map((tab) => trigger(tab))}
      {OPTIONAL_TABS.map((tab) => trigger(tab, !optionalInBar || !(tab.flag && flags[tab.flag])))}
      {trigger(SETTINGS_TAB)}
    </NativeTabs>
  );
}
