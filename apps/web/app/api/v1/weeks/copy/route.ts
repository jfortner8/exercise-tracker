import { api, field } from "@/lib/api";
import { copyWeek } from "@/lib/services/workouts";

/** POST /api/v1/weeks/copy — body { fromStart, toStart, times }: copy a week's workouts as planned. → { copied } */
export const POST = api(({ sub, body }) =>
  copyWeek(sub, field<string>(body, "fromStart") ?? "", field<string>(body, "toStart") ?? "", field<number>(body, "times") ?? 1),
);
