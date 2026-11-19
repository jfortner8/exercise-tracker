import { Cigarette, CupSoda, Wine, type LucideProps } from "lucide-react";
import type { HabitKind } from "@/lib/habits";

const ICONS = { alcohol: Wine, sugary: CupSoda, tobacco: Cigarette } as const;

/** The icon for a daily counter. Decorative: the label or number next to it says what it is. */
export function HabitIcon({ kind, ...props }: { kind: HabitKind } & LucideProps) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden {...props} />;
}
