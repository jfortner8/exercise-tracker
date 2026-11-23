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

### Me
| Method | Path | Body → Response |
|---|---|---|
| GET | `/me` | → `{ user: { sub, email }, profile, navFlags, today }`. `navFlags` says which optional tabs to show (Sports, Weight, Routines, Injuries) |
| PUT | `/me/profile` | The settings form (`ProfileInput`) → the same as `GET /me`, with the saved settings |
| POST | `/me/time-zone` | `{ timeZone }` (IANA). Send it when the phone's zone differs from `profile.timeZone` |
| DELETE | `/me` | `{ confirm: true }` → `{ deleted }`. Deletes the account for good: leaves every club (admin passes to the longest-standing member; a club they were alone in is deleted), ends friendships on both sides, retires the friend code and calendar link, deletes all their data, then the sign-in. Safe to retry. The app should then drop its token |

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

### Benchmarks
| Method | Path | Body → Response |
|---|---|---|
| GET | `/benchmarks` | → `{ benchmarks, results }`: everything tracked and every result. Work out PBs and trends with `@et/core`; the built-in catalog is `@et/core/benchmarks/catalog` |
| GET | `/benchmarks/:id` | → `{ benchmark, results }` |
| POST | `/benchmarks` | A custom benchmark `{ name, category, metricKind, direction, unit? }` → `{ id }` |
| POST | `/benchmarks/catalog/:key` | Tracks a built-in benchmark → `{ id }`, the existing one if it's already tracked |
| DELETE | `/benchmarks/:id` | The benchmark and all its results |
| POST | `/benchmarks/:id/results` | `{ date, value, reps?, workoutId?, notes? }` → `{ id }`. `value` is canonical (seconds, meters, kg, a count, or the custom number). `workoutId` must be on the same date and of a fitting type |
| PUT | `/benchmarks/:id/results/:date/:resultId` | The whole result again. A field left out is cleared; a new `date` moves it |
| DELETE | `/benchmarks/:id/results/:date/:resultId` | |

### Injuries
| Method | Path | Body → Response |
|---|---|---|
| GET | `/injuries` | → `{ injuries, pain }`. `pain[injuryId]` is the pain levels logged on workouts linked to it, oldest first: `[{ date, level, title }]` |
| POST | `/injuries` | `{ name, bodyPart?, startDate, endDate?, status, notes? }` → `{ id }`. `status` is `active`, `recovering` or `healed` |
| PUT | `/injuries/:id` | The whole injury again. A field left out is cleared |
| DELETE | `/injuries/:id` | Workouts linked to it are left as they are |

### Routines
| Method | Path | Body → Response |
|---|---|---|
| GET | `/routines` | → `{ routines }` |
| POST | `/routines` | `{ name, exercises: [{ name, sets?, reps?, weightKg? }] }` → `{ id }`. Names are unique, ignoring case; at least one exercise |
| PUT | `/routines/:id` | The same body. Workouts already on the calendar keep their own copy |
| DELETE | `/routines/:id` | The Routines tab (`navFlags.showRoutines`) goes with the last one |

### Sports and weight
| Method | Path | Body → Response |
|---|---|---|
| GET | `/sports` | → `{ year, tallies }`: completed sessions per sport (`SportTally` in `@et/core/sports`). `thisYear` counts `year`, where the user is |
| GET | `/weight` | → `{ trackWeight, today, series }`: weigh-ins in kg, oldest first, each with its 7-day average (`WeightPoint` in `@et/core/weight`). Empty while tracking is off. Weigh-ins are saved with `PUT /days/:date { weightKg }` |

### Friends and clubs
| Method | Path | Body → Response |
|---|---|---|
| GET | `/social` | → `{ friendCode, friends, clubs }`. The friend code is made the first time it's asked for. `clubs` is `[{ club, memberCount, isAdmin }]`, by name |
| POST | `/social/join` | `{ code }` → `{ kind: "friend", friend, message }` or `{ kind: "club", club, message }`. A friend's code adds them; a club's code joins it. Dashes, spaces and case don't matter. 404 for an unknown code, 409 if already friends or in the club, 429 after 20 wrong codes in a day |
| POST | `/social/code/reset` | → `{ friendCode }`. The old code stops working; friends stay |
| DELETE | `/friends/:sub` | Ends the friendship on both sides |
| POST | `/clubs` | `{ name }` → `{ club }`, with you as admin |
| GET | `/clubs/:id` | → `{ club, members, isAdmin, heir }`. Members only: a 404 to anyone else. `heir` becomes admin if the admin leaves |
| PATCH | `/clubs/:id` | `{ name }`. Admin only (403 otherwise) |
| DELETE | `/clubs/:id` | Deletes it for everyone. Admin only |
| POST | `/clubs/:id/leave` | → `{ deleted, message }`. Admin passes to the longest-standing member; the last one out deletes the club |
| POST | `/clubs/:id/code/reset` | → `{ code }`. Admin only; members stay in |
| DELETE | `/clubs/:id/members/:sub` | Admin only |
| POST | `/clubs/:id/members/:sub/admin` | Hands admin over. Admin only |

### Leaderboards
| Method | Path | Body → Response |
|---|---|---|
| GET | `/leaderboards?g=friends\|everyone\|<clubId>` | → `{ groups, group, boards, consistency, hasConsistency, friendCount }`. `boards[catalogKey]` is that benchmark's entries; work out the views (best, season, improvement, consistency ranking) with `@et/core/leaderboard-views` and `@et/core/domain`. A club you're not in is a 404. Defaults to friends |

### Calendar feed
| Method | Path | Body → Response |
|---|---|---|
| GET | `/calendar-feed` | → `{ enabled, url, webcalUrl, includeNotes, plannedOnly }`. `url` is the private `.ics` link calendar apps subscribe to; `webcalUrl` opens the system's subscribe flow |
| POST | `/calendar-feed` | Turns it on (no change if already on) → the same as GET. Start times are written in `{ timeZone }` if sent, else `X-Time-Zone` |
| POST | `/calendar-feed/reset` | A new link; the old one stops working → the same as GET. 409 if it changed meanwhile |
| DELETE | `/calendar-feed` | Turns it off |
| PUT | `/calendar-feed/options` | `{ includeNotes, plannedOnly }` |

**Still to come**, in the order of the plan:
- the rest of auth (sign-up, confirm, forgot and reset password)
