# Exercise Tracker

A calendar-first workout tracker. Past days show what you actually did, and future days show what you planned. Built with Next.js 16 on Vercel, backed by AWS (DynamoDB + Cognito).

## Features
- **Calendar** (month/week): planned workouts (dashed) vs. done (solid), "needs review" for past plans you never logged, drag to reschedule (keeps "moved from"), and copy or repeat a week.
- **Plan vs. actual** on every workout, with structured intervals (reps × work/rest + warm-up/cool-down; the total is calculated for you), status (completed / partial / skipped / missed / did something else), effort, pain, and a linked injury.
- **Day notes**, yes/no **daily goals** (stretched, enough protein… check them off each day) and optional **daily counters** (alcoholic drinks, sugary drinks, tobacco): tick the ones you want in Settings and pick one to show on the calendar.
- **Injuries**: date ranges shown as stripes on the calendar, plus a pain timeline from linked workouts.
- **Benchmarks**: PBs for anything measurable (time, distance, weight × reps scored as estimated 1RM, reps, duration, or a custom unit), built-in suggestions, charts.

## Architecture
- `app/`: App Router pages (Cache Components on; session reads stream inside `<Suspense>`). `proxy.ts` does the optimistic auth redirect.
- `lib/auth/`: the app's own sign-in, sign-up, confirm, and reset pages call Cognito's API from the server (`USER_PASSWORD_AUTH` + `SECRET_HASH`); the Cognito ID token is verified, then a signed HTTP-only session cookie (`jose`) is set.
- `lib/dal.ts`: `requireUser()`, the only source of the user id for data access.
- `lib/db/repo.ts`: single-table DynamoDB access (`PK=USER#<sub>`).
- `lib/actions.ts`: server actions (Zod-validated).
- `lib/domain.ts`: pure logic (intervals, PBs, statuses, units), tested in `lib/domain.test.ts`.
- `infra/`: AWS CDK stack: DynamoDB table, Cognito user pool + managed login, and the IAM role Vercel assumes via **OIDC federation** (no AWS keys stored anywhere).

## Local development
```bash
npm install
vercel env pull .env.local   # or copy values from `cd infra && npm run deploy` outputs
npm run dev
```
Locally the app uses your AWS CLI credentials. On Vercel it exchanges the deployment's OIDC token for the `exercise-tracker-vercel` role.

Env vars: `APP_AWS_REGION`, `APP_AWS_ROLE_ARN` (Vercel only), `TABLE_NAME`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AUTH_SECRET`.

## Users
Anyone can create an account at `/signup` (Cognito emails a confirmation code). To close sign-ups, set `"selfSignUp": false` in `infra/cdk.json` and redeploy the infra.

## Infra changes
```bash
cd infra && npm install && npm run deploy
```

## Tests
```bash
npm test
```
