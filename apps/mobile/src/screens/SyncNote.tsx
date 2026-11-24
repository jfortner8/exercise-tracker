import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Text, View } from "react-native";
import { dismissRefused, flush, useOutbox } from "@/api/outbox";
import { useTheme } from "@/theme";
import { Button } from "@/ui";

/**
 * Keeps the outbox moving while signed in: at launch, when the app comes back to the front, and
 * every 20 seconds while something waits. Whatever got through refreshes the screens.
 */
export function OutboxSync() {
  const qc = useQueryClient();
  const { pending } = useOutbox();
  const waiting = pending.length > 0;
  useEffect(() => {
    const go = () =>
      void flush().then((sent) => {
        if (sent) void qc.invalidateQueries();
      });
    go();
    const sub = AppState.addEventListener("change", (s) => s === "active" && go());
    const timer = waiting ? setInterval(go, 20_000) : undefined;
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [qc, waiting]);
  return null;
}

/** "2 changes are saved on this phone…" and anything the server turned down. Renders nothing otherwise. */
export function SyncNote() {
  const t = useTheme();
  const { pending, refused } = useOutbox();
  if (!pending.length && !refused.length) return null;
  const names = [...new Set(pending.map((p) => p.label))].join(", ");
  return (
    <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderColor: t.warn, backgroundColor: t.warnBg, borderRadius: 12, padding: 12, marginBottom: 12 }}>
      {pending.length > 0 && (
        <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>
          <Text style={{ fontWeight: "700" }}>
            {pending.length === 1 ? "1 change is" : `${pending.length} changes are`} saved on this phone
          </Text>{" "}
          and will sync when you&apos;re back online ({names}). The calendar shows them once they do.
        </Text>
      )}
      {refused.map((r, i) => (
        <Text key={i} style={{ color: t.danger, fontSize: 14, marginTop: pending.length || i ? 6 : 0 }}>
          Couldn&apos;t save “{r.label}”: {r.message}
        </Text>
      ))}
      {refused.length > 0 && <Button title="OK" variant="link" onPress={dismissRefused} />}
    </View>
  );
}
