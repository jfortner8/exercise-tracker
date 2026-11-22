# A phone app for Exercise Tracker: options, design and cost

_Written 2026-11-22. The proof endpoint described in section 6 is in this same PR._

## 1. Why

**What we're hearing:** the few people who've tried the site keep saying they'd use it as a phone app, and the real usage agrees. Every workout logged so far was logged on a phone. The desktop is for debugging and for longer review sessions.

**Why an app suits a tracker better than Reddit:** Reddit is reading, which a browser handles well. A tracker is a quick task done mid-activity, and that's where native apps clearly win:

- **Where you log:** right after a run, at the gym, on a trail, often one-handed, sometimes with poor signal.
- **Getting there:** an icon on the home screen, already signed in, opening straight to today.
- **Reminders:** a nudge to log a workout or weigh in. Without them, people forget the app exists.
- **Trust:** many people judge whether something is "real" by whether it's in the App Store, so a website reads as a side project to them. This is part of the feedback, separate from the features.

**Not part of this:** importing from Strava or Apple Health. That was decided against earlier, because matching imports to plans needs manual work anyway.

## 2. The three options

| | A. Home-screen web app (PWA) | B. The site wrapped in a native shell | C. React Native app (Expo) |
|---|---|---|---|
| What it is | The current site, plus an install manifest, a phone tab bar and an offline shell | Capacitor or a WebView loading the site inside a store app | A real native app that talks to our server through `/api/v1` |
| Effort | **3–6 days** | 5–10 days, plus fighting App Review | **~6–10 weeks of focused work** for the full app (section 7). A usable core comes sooner. |
| Feels native | Fairly close on Android. Close on iOS but noticeably web (scrolling, keyboard, no native sheets) | The same as A, inside an app icon | Yes: native tabs (Liquid Glass on iOS 26), sheets, haptics, gestures |
| In the App Store / Play Store | No ("Add to Home Screen" by hand on iOS) | Yes, if it gets through review | Yes |
| Offline | The shell only. Logging needs a connection unless we add a sync layer | The same as A | Cached screens and queued logging are realistic |
| Notifications | Web push. On iOS it only works once added to the home screen (iOS 16.4+) | Native push, added on | Native, including local reminders that need no server |
| Ongoing work | None beyond the site | Two release paths, and the same web UI | **Two clients to keep in step**, plus store releases (Expo's EAS Update can ship JS-only fixes without review) |
| Main risk | Doesn't fix the App Store trust signal | **Apple's Guideline 4.2** rejects apps that are just a repackaged website | Time. It's a real second front end |

**About B:** Apple's minimum-functionality rule (4.2) asks whether an app offers more than a repackaged website, and wrapper apps get rejected for exactly this. B costs nearly as much as A and adds that risk, so it isn't recommended.

**Recommendation:**

1. **Do A now. It's cheap and it's useful whatever happens.** Add a manifest, a bottom tab bar at phone widths, safe-area padding and the standalone display mode. Then ask the people who gave the feedback to install it from the home screen for two weeks.
   - **If the complaints stop,** they wanted something that behaves like an app, and you've saved months.
   - **If they still say "I'd use it if it were in the App Store,"** that's a clear signal for C. Nothing built for A is thrown away.
2. **Build C the way you described:** route handlers over a shared service layer, and an Expo app with the same design and native tabs. The rest of this document is about C.

## 3. Turning the backend into an API

### What we have now
- **38 server actions** (`lib/actions.ts` 24, `lib/social-actions.ts` 10, `lib/calendar-actions.ts` 4) plus 6 auth actions (`lib/auth/actions.ts`).
  - **An app can't call them:** Next compiles each one into a POST tied to a page, with an ID that changes on every build (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`).
  - **They're tied to the website:** every one starts with `requireUser()` (a cookie, or `redirect("/login")`) and most end with `afterChange()` → `refresh()`.
- **Reads have no API at all:** 14 pages call `lib/db/repo.ts` directly from Server Components.
- **The useful part is that the logic is already on the server.** That covers validation (zod), leaderboard and Consistency syncing, PB detection and time zones. An app should reuse all of it rather than reimplement it, which is exactly what your idea does.

### Shape
Next calls this "backend for frontend": route handlers are public HTTP endpoints that return JSON (`02-guides/backend-for-frontend.md`).

```
apps call  ──►  app/api/v1/**/route.ts   (auth: Bearer token → parse input → call service → JSON)
website    ──►  lib/actions.ts            (auth: cookie       → parse input → call service → refresh())
                         │
                         ▼
               lib/services/*.ts   (takes sub + input, returns data; no cookies, redirect or refresh)
                         │
                         ▼
               lib/db/repo.ts  →  DynamoDB
```

- **Endpoints follow screens,** not one per action. For example, `GET /api/v1/calendar?from&to` returns workouts, day logs, injuries, benchmarks and the results in range in one round trip, which is what the calendar page assembles now. Writes map roughly one to one onto today's actions (`POST /api/v1/workouts`, `POST /api/v1/days/:date/goals`, …).
- **Estimated size:** about 10 read endpoints and about 25 write endpoints. Several of the 38 actions merge, such as the club admin actions and the three calendar-feed actions.
- **Auth:** the app signs in with `POST /api/v1/auth/login` and gets back the same signed 30-day session the website keeps in its cookie, then sends it as `Authorization: Bearer …`. Cognito stays on the server, so no AWS credentials ever reach a phone.
- **"Today":** the app sends `X-Time-Zone`, and it goes through the same `userZone()` the website uses with its `tz` cookie.

### Pros
- **One backend and one set of rules.** A bug fix in, say, the PB logic fixes both clients.
- **Nothing sensitive on the phone:** no DynamoDB access and no Cognito secret.
- **The website doesn't change.** Its actions become thin wrappers around the same services. The calendar page already works this way in this PR.
- **The service layer helps the website too:** logic can be tested without Next's request machinery.
- **The API is ready for other clients later,** such as a watch app or widgets.

### Cons and risks
- **Everything is public.** Every endpoint is reachable by anyone on the internet, so each one has to authenticate and validate. Server actions already carry this risk; they just hide it. Keep the habit the code already has: zod on every input, and `sub` only ever taken from the verified token.
- **Rate limiting.** It isn't there today. At least `/api/v1/auth/*` needs it; Cognito has its own limits, but they produce confusing errors. Vercel's firewall rules or a small counter in DynamoDB would do.
- **Versioning is forever-ish.** Old app versions stay installed for months, so a `/api/v1` response must never lose or rename a field. Add fields freely, and make breaking changes under `/api/v2`. This is the biggest change from working on a website, where every client updates on the next page load.
- **Token lifetime.** A 30-day token in the phone's secure storage is simple, but it can't be revoked before it expires. If that matters later, add short-lived access tokens with refresh tokens, or a `tokenVersion` on the profile that is checked on each request (one extra read).
- **Keeping two clients in step.** A new feature now means the API, the website and the app, so sharing the `lib` logic (section 4) matters.
- **More function calls on Vercel.** Every app screen is an API call. At this scale it's negligible, but worth keeping an eye on.
- **CORS doesn't apply to native apps,** only to browsers. The API sends no CORS headers, so other websites can't call it from a browser. That's the intended default.

## 4. Code layout

A monorepo with three packages, so the pure logic is written once:

```
packages/core   ← today's pure lib modules: domain, activities, goals, habits, splits, start-time,
                  sports, dance, weight, quick-done, routines, injuries, benchmarks/*, types, …
                  (about 20 modules; they only need date-fns and zod)
apps/web        ← this Next.js app, importing @et/core
apps/mobile     ← Expo app, importing @et/core and calling /api/v1
```

- **What the app gets for free:** formatting (`formatStartTime`, `startTimeLabel`, `formatDistance`), titles (`autoTitle`), the habit and goal logic, the splits helper and validation, and the 150+ unit tests that cover them.
- **What can't be shared:** about 5,800 lines of DOM and Tailwind components. They get rebuilt in React Native.
  - **NativeWind** lets the app use the same Tailwind classes and colour tokens, so the look carries over.
  - **Layouts** can't be pasted in.

## 5. App design

The same visual design and the same features in the same order, laid out the way phones expect.

- **Navigation:** Expo Router's `NativeTabs` give a real UIKit tab bar, which on iOS 26 is the Liquid Glass bar you described, and Material tabs on Android.
  - **Tabs:** Calendar · Benchmarks · Leaderboards · Weight · Settings, matching the current nav.
  - **The progressive tabs** (Sports, Injuries, Routines, Friends and clubs) appear the same way they do now, once first used. If there are too many for a phone, the extra ones go under Settings.
  - **Caution:** this API was marked beta when it launched and its import path has changed between releases. Check the current docs when starting.
- **Calendar:** month and week views as now.
  - **The day drawer becomes a native bottom sheet** that you swipe up for more and down to close.
  - **Drag to reschedule** (currently dnd-kit) becomes long-press-and-drag with Gesture Handler and Reanimated, with a haptic tick on drop.
- **Logging:** the workout form becomes a full-screen modal with native time and date pickers and the number keyboard.
  - **Quick Done** becomes a swipe action on a day's workout.
  - **"Work it out from splits"** reuses `@et/core/splits` directly.
- **Charts:** Recharts (weight trend, benchmark history) becomes Victory Native, which draws with Skia.
- **Smaller native touches:** local notifications for "log today's workout?" and the weekly weigh-in, Face ID to unlock if wanted, and pull-to-refresh.
- **Data:** TanStack Query against `/api/v1`, with cache persistence so the app opens instantly on the last data, and optimistic updates for quick logging.

## 6. What the proof endpoint shows

Built in this PR:

- **`GET /api/v1/calendar?from&to`** (`app/api/v1/calendar/route.ts`)
  - **Returns:** `{ from, to, today, startDate, workouts, days, injuries, benchmarks, results }`.
  - **Limits:** at most 62 days per call, and `Cache-Control: private, no-store`.
  - **Errors:** 401 without a valid token, 400 with a message for a bad range.
- **`POST /api/v1/auth/login`** (`app/api/v1/auth/login/route.ts`): returns `{ token, expiresIn, user }`, using the website's error messages and the same "unconfirmed email" handling.
- **`lib/api-auth.ts`:** `userFromRequest()` accepts a Bearer token or the website's cookie.
- **`lib/services/calendar.ts`:** the first service, used by **both** the website's calendar page and the API.
- **`proxy.ts`:** now leaves `/api/v1` alone. Before, it redirected token-only requests to the login page, which a phone app can't handle.

**Live test against the dev server:** 13 of 13 checks passed.
- Requests with no token or a bad token get 401, and a backwards range gets 400.
- A valid token returns the seeded workouts and day log.
- `today` follows the `X-Time-Zone` header and otherwise falls back to the profile's zone.
- Login gives 400 for missing fields and 401 with "Incorrect email or password." for a wrong password.
- The website still renders the same week through the shared service.

**What it taught us:**
- **The pattern is cheap per endpoint.** Each route is about 20 lines once the service exists.
- **Most of the backend work is moving logic** out of the actions into services. That's mechanical and covered by the existing tests.
- **The proxy needed changing,** which wouldn't have been obvious without trying it.

## 7. Effort

These are focused working days, assuming Claude Code is doing much of the typing. On a part-time schedule of about 2 focused days a week, multiply calendar time by about 2.5.

| Piece | Days | What drives it |
|---|---|---|
| Monorepo + `packages/core` move | 1–2 | Import paths; the tests come along |
| Service layer + `/api/v1` (≈10 reads, ≈25 writes) | 6–10 | 38 actions to split; versioning discipline |
| Rate limiting + token handling | 1–2 | Auth endpoints first |
| App auth (sign in, sign up, confirm, forgot password, secure storage, 401 → sign-in) | 2–3 | Six flows, already written once |
| App shell: tabs, theme tokens, dark mode, fonts | 2–4 | NativeWind setup, progressive tabs |
| Calendar month/week + day sheet + drag | 6–10 | **The biggest screen**; drag and drop and dense tiles |
| Workout form (all types, intervals, exercises, repeat) | 4–7 | Many conditional fields |
| Quick Done, rest days, goals, habits, weight entry | 2–3 | Mostly shared logic |
| Benchmarks, PBs, splits | 3–5 | Charts, linking |
| Leaderboards, friends, clubs | 3–5 | Many small screens |
| Weight trend, settings, injuries, routines, sports | 3–5 | |
| Notifications (local) | 1–2 | |
| Offline cache + optimistic logging | 2–4 | Queued writes are the hard part |
| Store prep and review: icons, screenshots, privacy policy, TestFlight | 2–4 | Plus waiting on review |
| **Total** | **≈38–66 days** | **≈2–3 months full time, ≈4–7 months part time** |

**Running costs:**
- **Apple Developer Program:** $99 a year.
- **Google Play:** $25 once.
- **Expo:** EAS builds have a free tier that's fine at this size.

**A minimum app that's worth shipping first:** sign-in, the calendar with the day sheet, logging and Quick Done, and weight. That's about **18–28 days** including the API it needs. Benchmarks, leaderboards and social stay on the website until they're ported.

## 8. Suggested order

1. **Now:** the PWA polish (option A) and asking the people who gave the feedback. *(3–6 days)*
2. **Merge this PR.** Then move the remaining actions onto services, one area at a time (workouts, days, benchmarks, social), each with its `/api/v1` routes. The website keeps working throughout.
3. **Set up the monorepo** and move the pure modules to `packages/core`.
4. **Build the Expo app's minimum version** and put it on TestFlight and a Play internal test for the same people.
5. **Port the remaining screens** by usage. Store release once the calendar and logging feel better than the website on a phone.

---

**Sources:**
- [Expo Router native tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Router v6 (Liquid Glass tabs)](https://expo.dev/blog/expo-router-v6)
- [App Review Guidelines](https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-English-UK.pdf)
- [WebView wrappers and Guideline 4.2](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- Next.js docs in `node_modules/next/dist/docs/01-app/02-guides/` (`backend-for-frontend.md`, `server-actions.md`, `data-security.md`)
