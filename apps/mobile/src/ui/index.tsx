import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

/** A scrolling page on the app's background, inside the safe area. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useTheme();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
        {children}
      </Text>
      {subtitle ? <Text style={[styles.body, { color: t.muted, marginTop: 4 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "link";
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : variant === "link" ? "transparent" : t.surface;
  const fg =
    variant === "primary" ? t.accentFg : variant === "danger" ? t.danger : variant === "link" ? t.accentInk : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === "secondary" || variant === "danger" ? { borderWidth: 1, borderColor: t.border } : null,
        variant === "link" ? { height: 36 } : null,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: error ? t.danger : t.border }]}
        {...input}
      />
      {error ? <Text style={[styles.small, { color: t.danger, marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  const t = useTheme();
  return children ? <Text style={[styles.body, { color: t.danger, marginBottom: 12 }]}>{children}</Text> : null;
}

const styles = StyleSheet.create({
  // The web build (development only) draws the tab bar over the top of the page.
  screen: { padding: 20, paddingBottom: 48, paddingTop: Platform.OS === "web" ? 84 : 20 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  button: {
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 6,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
