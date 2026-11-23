import { api } from "@/lib/api";
import { saveFeedOptions } from "@/lib/services/calendar-feed";

/** PUT /api/v1/calendar-feed/options — { includeNotes, plannedOnly }: what the feed shows. */
export const PUT = api(({ sub, body }) => saveFeedOptions(sub, body as { includeNotes: boolean; plannedOnly: boolean }));
