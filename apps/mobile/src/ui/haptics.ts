import * as Haptics from "expo-haptics";

/** Small taps of feedback. They do nothing where the phone has no haptics (or on the web build). */
export const haptic = {
  /** Picking something up (a long press to move). */
  pickUp: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** A toggle or a tick. */
  tick: () => void Haptics.selectionAsync().catch(() => {}),
  /** Something saved that's worth a little cheer: a move dropped, a result recorded. */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
