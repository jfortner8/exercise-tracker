import { Share, Text, View } from "react-native";
import { formatCode } from "@et/core/social";
import { useTheme } from "@/theme";
import { Button } from "@/ui";
import { Row } from "@/ui/form";

/**
 * A friend or club code, big enough to read out, with the phone's share sheet (which also has Copy)
 * and, when allowed, a new code.
 */
export function CodeCard({ code, shareText, onReset, busy }: { code: string; shareText: string; onReset?: () => void; busy?: boolean }) {
  const t = useTheme();
  const shown = formatCode(code);
  return (
    <View>
      <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginVertical: 8 }}>
        <Text selectable accessibilityLabel={`Code ${shown}`} style={{ color: t.text, fontSize: 20, fontWeight: "700", letterSpacing: 2, fontVariant: ["tabular-nums"] }}>
          {shown}
        </Text>
      </View>
      <Row>
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
