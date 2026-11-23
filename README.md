# Exercise Tracker

A calendar-first workout tracker. Past days show what you actually did, and future days show what you planned. Built with Next.js 16 on Vercel, backed by AWS (DynamoDB + Cognito).

## Features
- **Calendar** (month/week): planned workouts (dashed) vs. done (solid), "needs review" for past plans you never logged, drag to reschedule (keeps "moved from"), and copy or repeat a week.
- **Plan vs. actual** on every workout, with structured intervals (reps × work/rest + warm-up/cool-down; the total is calculated for you), status (completed / partial / skipped / missed / did something else), effort, pain, and a linked injury.
- **Day notes**, yes/no **daily goals** (stretched, enough protein… check them off each day) and optional **daily counters** (alcoholic drinks, sugary drinks, tobacco): tick the ones you want in Settings and pick one to show on the calendar.
- **Injuries**: date ranges shown as stripes on the calendar, plus a pain timeline from linked workouts.
- **Benchmarks**: PBs for anything measurable (time, distance, weight × reps scored as estimated 1RM, reps, duration, or a custom unit), built-in suggestions, charts.

## Architecture
An npm workspace with three packages:

- `apps/web`: the Next.js website and the API the phone app calls.
  - `app/`: App Router pages (Cache Components on; session reads stream inside `<Suspense>`). `proxy.ts` does the optimistic auth redirect for pages.
  - `app/api/v1/`: JSON endpoints for the phone app. They authenticate with `Authorization: Bearer <session token>` (from `POST /api/v1/auth/login`) and take the user's zone from `X-Time-Zone`.
  - `lib/auth/`: sign-in, sign-up, confirm and reset call Cognito's API from the server (`USER_PASSWORD_AUTH` + `SECRET_HASH`). The Cognito ID token is verified, then a signed session (`jose`) is set as an HTTP-only cookie (website) or returned as a Bearer token (app).
  - `lib/dal.ts`: `requireUser()`, the only source of the user id for pages and server actions. `lib/api-auth.ts` is the same for API requests.
  - `lib/services/`: data logic shared by pages, server actions and API routes.
  - `lib/db/repo.ts`: single-table DynamoDB access (`PK=USER#<sub>`).
  - `lib/actions.ts`: server actions.
- `packages/core` (`@et/core`): pure logic shared by the website, the API and the phone app. It has no React and no server code. It covers dates and units, activities, goals and habits, splits, start-time zones, PBs, social codes, and the Zod input schemas (`schemas.ts`) that every input is validated with.
- `apps/mobile`: the Expo phone app (Expo SDK 58, Expo Router with native tabs). It talks to the website's `/api/v1` ([docs/api.md](docs/api.md)); see [Phone app](#phone-app).
- `infra/terraform/`: Terraform for the AWS resources: the DynamoDB table, the Cognito user pool, and the IAM role Vercel assumes via **OIDC federation** (no AWS keys stored anywhere). GitHub Actions plans and applies it; see [infra/terraform/README.md](infra/terraform/README.md).

## Local development
```bash
npm install
vercel env pull apps/web/.env.local
npm run dev                          # runs the website from apps/web
```
Locally the app uses your AWS CLI credentials. On Vercel it exchanges the deployment's OIDC token for the `exercise-tracker-vercel` role.

Env vars: `APP_AWS_REGION`, `APP_AWS_ROLE_ARN` (Vercel only), `TABLE_NAME`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AUTH_SECRET`.

## Phone app
The app in `apps/mobile` uses the live API (`https://exercise.johnafortner.com`) unless `EXPO_PUBLIC_API_URL` says otherwise.

**On your phone, no build needed:** install **Expo Go** from the App Store or Play Store, then:
```bash
npm run mobile
```
Scan the QR code it prints (iPhone: with the Camera app; Android: in Expo Go). The phone and the computer need to be on the same Wi-Fi.

**In a browser, against your local API:** put `EXPO_PUBLIC_API_URL=http://localhost:3000` in `apps/mobile/.env.local`, run `npm run dev` for the API, then `npm run web -w @et/mobile`. In development only, the API allows cross-origin calls for this (`next.config.ts`).

**Builds, TestFlight and updates** run on EAS from GitHub Actions (`.github/workflows/eas.yml`), like photo-mapper:
- **Every merge to `main` that changes the app** sends its JavaScript to installed preview and TestFlight builds (`eas update`, channel `preview`). A build only takes an update made from the same native code (`runtimeVersion: fingerprint`). Adding a native package needs a new build.
- **By hand: Actions → EAS → Run workflow:**
  - `ios-testflight`: a store build sent to TestFlight. It follows the `preview` channel, so merges reach testers.
  - `android-preview-apk`: an installable APK link.
  - `android-play-internal`: Play's internal testing track (once Play is set up).
  - `update-production`: ships `main` to store builds.

**One-time setup** (the workflow skips itself until step 1):
1. **Expo token:** create one at expo.dev → Account settings → Access tokens. Add it as the `EXPO_TOKEN` secret in GitHub → Settings → Secrets and variables → Actions.
2. **Apple:** run the first iOS build from your own terminal, because it signs in to your Apple Developer account. It creates the signing certificates, the App Store Connect app, and an App Store Connect API key for later submissions. After that, CI builds and submits on its own:
   ```bash
   cd apps/mobile && npx eas-cli@latest build --platform ios --profile testflight --auto-submit-with-profile production
   ```
3. **Google Play (later):** pay the $25 developer fee, upload the first build by hand (Play requires it), and add a service account key for `eas submit`. New personal Play accounts must run a closed test with at least 12 testers for 14 days before production access.

## Users
Anyone can create an account at `/signup` (Cognito emails a confirmation code). To close sign-ups, set `self_sign_up` to `false` in `infra/terraform/variables.tf` and merge the change.

## Infra changes
Edit `infra/terraform` in a pull request. The `infra` workflow posts the plan on the pull request, and merging to `main` applies it. Nobody runs `terraform apply` by hand.

## Tests
```bash
npm test
```
