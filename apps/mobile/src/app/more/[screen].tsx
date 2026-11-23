import { Redirect, useLocalSearchParams } from "expo-router";
import { useSession } from "@/auth/session";
import { Injuries } from "@/screens/optional/Injuries";
import { Routines } from "@/screens/optional/Routines";
import { Sports } from "@/screens/optional/Sports";
import { Weight } from "@/screens/optional/Weight";

const SCREENS = { sports: Sports, weight: Weight, routines: Routines, injuries: Injuries } as const;

/** Android's way into the optional tabs (its tab bar holds five): Settings links here. */
export default function MoreScreen() {
  const { screen } = useLocalSearchParams<{ screen: string }>();
  const Comp = SCREENS[screen as keyof typeof SCREENS];
  if (useSession().status !== "signedIn") return <Redirect href="/sign-in" />;
  if (!Comp) return <Redirect href="/settings" />;
  return <Comp header />;
}
