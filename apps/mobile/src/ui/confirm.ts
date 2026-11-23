import { Alert, Platform } from "react-native";

/**
 * Asks before something that can't be taken back: a native alert on phones, the browser's confirm
 * in the web build. Resolves true when the user goes ahead.
 */
export function ask(title: string, message: string, ok: string, destructive = false): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(!!globalThis.confirm?.(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/**
 * One choice from a short list (a native action alert; numbered prompt in the web build).
 * Resolves the chosen index, or null for Cancel.
 */
export function choose(title: string, message: string, options: string[]): Promise<number | null> {
  if (Platform.OS === "web") {
    const a = globalThis.prompt?.(`${title}\n${message}\n\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`, "1");
    const n = Number(a) - 1;
    return Promise.resolve(Number.isInteger(n) && n >= 0 && n < options.length ? n : null);
  }
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [...options.map((text, i) => ({ text, onPress: () => resolve(i) })), { text: "Cancel", style: "cancel" as const, onPress: () => resolve(null) }],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}
