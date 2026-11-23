# Phone app API (`/api/v1`)

JSON endpoints the Expo app calls. They're route handlers in `apps/web/app/api/v1/**/route.ts`. Each one is a few lines over a shared service in `apps/web/lib/services/`, which the website's server actions call too, so both clients follow the same rules.

## Rules

- **Auth:** send `Authorization: Bearer <token>`. The token comes from `POST /api/v1/auth/login` and lasts 30 days. Without a valid token the API answers `401 { error, code: "UNAUTHENTICATED" }`, and the app goes back to sign-in. The website's session cookie works too.
- **Time zone:** send `X-Time-Zone: <IANA zone>` (for example `America/New_York`) on every request. It decides "today" (rest days, the calendar's `today`). Without it, the profile's saved zone is used.
- **Bodies:** JSON with `Content-Type: application/json`. Inputs are checked with the Zod schemas in `@et/core/schemas`, the same ones the website uses.
- **Responses:** JSON with `Cache-Control: private, no-store`. A write with nothing to return answers `{ ok: true }`.
- **Errors:** `{ error, code?, field? }`. `error` is a message to show the user.

  | Status | When |
  |---|---|
  | 400 | Bad input. `field` names the first bad input, such as `"title"` |
  | 401 | Not signed in |
  | 404 | Not found, such as `"Workout not found"` |
  | 429 | Rate limited (`code: "RATE_LIMITED"`) |
  | 500 | Something unexpected. It's logged on the server |
- **Rate limits:** 120 writes a minute per user. Reads aren't limited. The counters are DynamoDB items under `RL#…` that expire through the table's TTL on `expiresAt` (set up in `infra/`).
- **Versioning:** `v1` responses **only ever gain fields**. A field is never removed, renamed or changed in meaning, because old app builds stay installed for months. A breaking change gets a new `/api/v2` route, and `v1` keeps working until no supported app version uses it.

## Endpoints

### Auth
| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, expiresIn, user }`. Gives `403 { code: "UNCONFIRMED" }` when the email isn't confirmed yet (a fresh code is sent) |

### Calendar
| Method | Path | Body → Response |
|---|---|---|
| GET | `/calendar?from=yyyy-MM-dd&to=yyyy-MM-dd` | → `{ from, to, today, startDate, workouts, days, injuries, benchmarks, results, routines, recent }`. At most 62 days per call |
| GET | `/days/:date/workouts` | → `{ workouts }` |

### Workouts
| Method | Path | Body → Response |
|---|---|---|
| POST | `/workouts` | `{ workout, repeat?, saveAsRoutine?: { name } }`. To edit, set `workout.id` and `workout.originalDate` (its current date); a different `workout.date` moves it |
| DELETE | `/workouts/:date/:id` | Deletes one workout |
| DELETE | `/workouts/:date/:id/series` | Deletes this one and the rest of its series that are still planned → `{ deleted }` |
| POST | `/workouts/:date/:id/move` | `{ toDate }` |
| POST | `/workouts/:date/:id/swap` | `{ toDate }`. That day's planned workouts move here |
| POST | `/workouts/:date/:id/quick-done` | `{ timeSec?, distanceM?, extraAs: "warmup" \| "cooldown" }` |
| POST | `/workouts/:date/:id/resolve` | `{ status: "completed" \| "missed" \| "skipped", reason? }`. `reason` is required for `skipped` |
| POST | `/weeks/copy` | `{ fromStart, toStart, times }` → `{ copied }` |

### Days
| Method | Path | Body → Response |
|---|---|---|
| PUT | `/days/:date` | `{ notes?, drinks?, sugaryDrinks?, tobacco?, weightKg? }`. A field left out keeps its value; `null` clears it |
| POST | `/days/:date/rest` | Adds a rest day: completed if today or earlier where the user is, planned if later |
| PUT | `/days/:date/goals/:goalId` | `{ done: boolean }` |

**Still to come**, in the order of the plan:
- profile and `me` (including account deletion)
- benchmarks and results
- injuries, routines, sports and weight
- friends, clubs and leaderboards
- the calendar feed
- the rest of auth (sign-up, confirm, forgot and reset password)
