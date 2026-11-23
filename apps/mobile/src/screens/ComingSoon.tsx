import * as WebBrowser from "expo-web-browser";
import { API_URL } from "@/config";
import type { TabDef } from "@/screens/tabs";
import { Body, Button, Card, Screen, Title } from "@/ui";

/** A screen the app doesn't have yet: says so, and opens the same page on the website meanwhile. */
export function ComingSoon({ tab, header }: { tab: TabDef; header?: boolean }) {
  return (
    <Screen header={header}>
      <Title>{tab.label}</Title>
      <Card>
        <Body>This screen is coming in a later version of the app.</Body>
        <Body muted style={{ marginTop: 6 }}>
          Until then, it&apos;s on the website, with the same account.
        </Body>
        <Button title={`Open ${tab.label} on the website`} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}${tab.web}`)} />
      </Card>
    </Screen>
  );
}
