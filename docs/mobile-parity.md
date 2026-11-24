# Phone app: plan and status

The phone app (`apps/mobile`, Expo) does everything the website does, sold as a one-time paid app; the website stays free. This file is the running plan: what's done, what's next, and the rules the work follows. Update it with each PR.

## How it's built
- **Monorepo:** npm workspaces. `apps/web` (Next.js 16, the website and `/api/v1`), `apps/mobile` (Expo SDK 58, Expo Router, React 19.3), `packages/core` (`@et/core`: shared logic, Zod schemas, `api-types.ts`, `workout-draft.ts`; no React).
- **API:** `/api/v1` route handlers over `apps/web/lib/services/*`, which the website's server actions also call. Bearer token from `/auth/login`, `X-Time-Zone` header, JSON errors `{ error, code?, field? }`. Reference: [api.md](api.md). v1 responses only ever gain fields.
- **App:** the token is kept in SecureStore; TanStack Query is cached in `expo-sqlite`'s key-value store. `NativeTabs`: 5 main tabs plus the earned ones (on Android those open from Settings). Screens with a native header use `<Screen header>`.
- **Infra:** Terraform in `infra/terraform`, planned and applied only by GitHub Actions through the account's `github-actions-runner` role (defined in archive-api). Nobody applies by hand.
- **CI:** path-filtered workflows `core`, `web`, `mobile`, `infra` and `EAS`. Vercel skips builds with no website changes (`scripts/vercel-ignore.sh`).
- **EAS:** project `@jfortner8/exercise-tracker`, bundle `com.jfortner8.exercisetracker`, `runtimeVersion: fingerprint`.
  - A merge that changes the app publishes an over-the-air update to the `preview` channel, which the TestFlight build follows.
  - Builds only run by hand: Actions → EAS → Run workflow (`ios-testflight`, `android-preview-apk`, `android-play-internal`, `update-production`).
  - **Adding a native package changes the fingerprint.** Updates then stop reaching the installed TestFlight build until a new build is made, so batch native additions together.

## Working rules
- **PRs:** each new PR branches from the previous unmerged one, but always targets `main`. The user merges; never merge yourself.
- **Credentials and deploys:** never enter passwords or handle tokens or secrets; never deploy by hand.
- **Test data:** test with scratch users under `USER#local-test-user-*` and delete them afterwards.
- **Commits and PRs:** commit messages end with the Co-Authored-By line; PR bodies end with the Claude Code line.
- **Keep usage down:** test through API scripts first and take few screenshots. A fresh session per feature is fine; this file is the handoff.
- **Local app testing:** put `EXPO_PUBLIC_API_URL=http://localhost:3000` in `apps/mobile/.env.local`, run the `dev` launch config, then `mobile-web` (it lands on port 8082, because something else holds 8081 and 8083). Sign in by putting a minted session token in `localStorage['session-token']`. Delete `.env.local` afterwards. Don't switch branches while Metro runs: it crashes on missing files.

## Status

### Done
- [x] Monorepo, shared core, every `/api/v1` endpoint (auth with rate limits, me and account deletion, calendar, workouts, days, benchmarks, injuries, routines, sports, weight, friends, clubs, leaderboards, calendar feed)
- [x] Privacy page (`/privacy`, contact jafortner8@gmail.com), and account deletion on the website
- [x] Terraform with CI applies; EAS builds, updates and TestFlight; the first iOS TestFlight build finished
- [x] App: sign-in screens, tabs, API client and cache, Settings (account, privacy, sign out, delete account)
- [x] App: month and week calendar, day sheet (goals, Done, Skipped, Missed, Delete, rest day, notes, weight, habits)
- [x] App: workout form (add, edit, done with details, did something else, repeat, routines, plan and actual)
- [x] App: Quick Done in the day sheet (time and distance from the plan, pace, warm-up or cool-down for extra time)
- [x] App, without native code: Ranks (every board and view), Friends and clubs (share sheet, join, club page with admin actions), the full Settings form (units, clock, habits, goals editor, sharing, theme, calendar feed), Sports, Weight (stats and weigh-ins), Routines editor, Injuries, PBs (list, suggestions, custom benchmarks, detail with results, splits helper, workout link), calendar extras (long-press a day to move its planned workout, or Move… in the day sheet; the swap question; copy week from the week view; results, injuries and Record a result in the day sheet; the start-time zone hint)

- [x] App, native: the phone's date and time pickers (`src/ui/date-field.tsx`; the web build keeps a stepper in `date-field.web.tsx`), charts on `react-native-svg` (PB history, Weight trend), haptics (moving a workout, ticking a goal, saving a result, copying), local reminders (a daily "log today's workout?" and a weekly weigh-in, in Settings; scheduled on the phone), and Copy for codes and the calendar link

- [x] TestFlight build 3 with every native package, tried on a real phone
- [x] Offline saving: calendar, day sheet, workout form, results, injuries and routines writes go through `src/api/outbox.ts` (kept on the phone in order, sent at launch, on return to the app, every 20 s and before the next write; a refused one is dropped and shown). Friends, clubs and Settings stay online-only
- [x] Generated workout names stay placeholders: `autoTitle` on the workout; older ones count as generated when the title matches

- [x] Race distances on PBs (website and app): each completed run, swim, ride or row counts once for the longest common race distance it reaches, 2% slack (`@et/core/race-distances`, `GET /race-distances`)
- [x] Tip jar in the app's Settings (`expo-iap`, native: ships with the next build). Free app; the website has a Buy Me a Coffee link instead

### Next, in order
1. [ ] **Tip jar store setup (the user):**
   - App Store Connect: sign the Paid Apps agreement, add tax and banking, then create three **consumable** in-app purchases with these product ids, each with a price, a display name, a description ("A tip to support development. Unlocks nothing.") and a review screenshot of the Support card:
     - `com.jfortner8.exercisetracker.tip.small` ($1.99)
     - `com.jfortner8.exercisetracker.tip.medium` ($4.99)
     - `com.jfortner8.exercisetracker.tip.large` ($9.99)
   - Google Play Console, later: a payments profile, then the same three ids as one-time products.
   - The tips card stays hidden until the store returns the products, so the build can ship before this is done.
2. [ ] **One new build** for `expo-iap` and the new app icon together (Actions → EAS → `ios-testflight`). Test a tip with a sandbox Apple account in TestFlight; it isn't charged.
3. [ ] Release: store icon (1024 px), screenshots, privacy labels; free app on both stores (see the pricing decision); Google Play ($25 fee; new personal accounts need a 12-tester, 14-day closed test)

## Parity checklist (tick on a real device before public release)
Sign-in flows · month and week calendar · day sheet · workout form · Quick Done · drag and swap · copy week · benchmarks · leaderboards · friends and clubs · injuries · routines · sports · weight · settings · calendar feed · delete account
