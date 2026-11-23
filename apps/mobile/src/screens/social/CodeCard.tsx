import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, Text, View } from "react-native";
import { formatCode } from "@et/core/social";
import { useTheme } from "@/theme";
import { Button } from "@/ui";
import { Row } from "@/ui/form";
import { haptic } from "@/ui/haptics";

/** A friend or club code, big enough to read out, with Copy, the share sheet and, when allowed, a new code. */
export function CodeCard({ code, shareText, onReset, busy }: { code: string; shareText: string; onReset?: () => void; busy?: boolean }) {
  const t = useTheme();
  const shown = formatCode(code);
  const [copied, setCopied] = useState(false);
  async function copy() {
    await Clipboard.setStringAsync(shown).catch(() => {});
    haptic.tick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <View>
      <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginVertical: 8 }}>
        <Text selectable accessibilityLabel={`Code ${shown}`} style={{ color: t.text, fontSize: 20, fontWeight: "700", letterSpacing: 2, fontVariant: ["tabular-nums"] }}>
          {shown}
        </Text>
      </View>
      <Row>
        <View style={{ flex: 1 }}>
          <Button title={copied ? "Copied" : "Copy"} variant="secondary" onPress={() => void copy()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Share" onPress={() => void Share.share({ message: `${shareText} ${shown}` }).catch(() => {})} />
        </View>
        {onReset ? (
          <View style={{ flex: 1 }}>
            <Button title="New code" variant="secondary" onPress={onReset} loading={busy} />
          </View>
        ) : null}
      </Row>
    </View>
  );
}
