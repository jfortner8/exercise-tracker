import { ComingSoon } from "@/screens/ComingSoon";
import { findTab } from "@/screens/tabs";

export default function Screen() {
  return <ComingSoon tab={findTab("routines")!} />;
}
