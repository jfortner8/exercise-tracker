import {
  endConnection,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
} from "expo-iap";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme";
import { Body, Button, Card } from "@/ui";
import { haptic } from "@/ui/haptics";
import { Row, SectionTitle } from "@/ui/form";

/**
 * One-off tips through the App Store or Google Play. They're consumable purchases that unlock
 * nothing, so they can be bought again; prices come from the store in the buyer's currency.
 * The same ids are set up in App Store Connect and the Play Console (see docs/releasing.md).
 */
export const TIP_SKUS = [
  "com.jfortner8.exercisetracker.tip.small",
  "com.jfortner8.exercisetracker.tip.medium",
  "com.jfortner8.exercisetracker.tip.large",
];

const LABEL: Record<string, string> = {
  [TIP_SKUS[0]]: "Small tip",
  [TIP_SKUS[1]]: "Medium tip",
  [TIP_SKUS[2]]: "Large tip",
};

/** Settings → Support the app. Renders nothing until the store has the tips (or if it can't be reached). */
export function TipJar() {
  const t = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const bought = purchaseUpdatedListener(async (purchase) => {
      if (!TIP_SKUS.includes(purchase.productId)) return;
      try {
        // Consumed, so the same tip can be given again.
        await finishTransaction({ purchase, isConsumable: true });
      } catch {}
      if (!live) return;
      haptic.success();
      setBusy(null);
      setThanks(true);
    });
    const failed = purchaseErrorListener((e) => {
      if (!live) return;
      setBusy(null);
      if (e.code !== ErrorCode.UserCancelled) setError(e.message || "The tip didn't go through. Nothing was charged.");
    });
    initConnection()
      .then(() => fetchProducts({ skus: TIP_SKUS, type: "in-app" }))
      .then((list) => {
        if (!live || !list) return;
        const tips = (list as Product[]).filter((p) => TIP_SKUS.includes(p.id));
        setProducts(tips.sort((a, b) => TIP_SKUS.indexOf(a.id) - TIP_SKUS.indexOf(b.id)));
      })
      .catch(() => {});
    return () => {
      live = false;
      bought.remove();
      failed.remove();
      void endConnection().catch(() => {});
    };
  }, []);

  if (!products.length) return null;

  async function tip(id: string) {
    setError(null);
    setThanks(false);
    setBusy(id);
    try {
      await requestPurchase({ request: { apple: { sku: id }, google: { skus: [id] } }, type: "in-app" });
    } catch (e) {
      setBusy(null);
      const code = (e as { code?: string }).code;
      if (code !== ErrorCode.UserCancelled) setError((e as Error).message || "The tip didn't go through. Nothing was charged.");
    }
  }

  return (
    <Card>
      <SectionTitle>Support the app</SectionTitle>
      <Body muted style={{ fontSize: 14, marginBottom: 6 }}>
        Exercise Tracker is free and made by one person. Tips don&apos;t unlock anything; they just help keep it running.
      </Body>
      <Row>
        {products.map((p) => (
          <View key={p.id} style={{ flex: 1 }}>
            <Button
              title={p.displayPrice}
              variant="secondary"
              loading={busy === p.id}
              disabled={!!busy && busy !== p.id}
              onPress={() => void tip(p.id)}
            />
            <Text style={{ color: t.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>{LABEL[p.id] ?? p.title}</Text>
          </View>
        ))}
      </Row>
      {thanks ? <Body style={{ marginTop: 10, color: t.accentInk, fontWeight: "600" }}>Thank you! That means a lot.</Body> : null}
      {error ? <Body style={{ marginTop: 10, color: t.danger }}>{error}</Body> : null}
    </Card>
  );
}
