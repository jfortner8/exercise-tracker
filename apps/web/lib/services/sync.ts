import "server-only";
import { syncConsistency } from "@/lib/leaderboard";

/**
 * After a change that can move which days were on track: refresh the Consistency board row. A failed
 * sync is logged, not thrown, so the user's own save still goes through.
 */
export async function syncAfterChange(sub: string) {
  try {
    await syncConsistency(sub);
  } catch (e) {
    console.error("syncConsistency failed", e);
  }
}
