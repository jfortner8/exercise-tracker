# Stride: exercise tracker

A calendar-first workout tracker. Past days show what you actually did, and future days show what you planned. Built with Next.js 16 on Vercel, backed by AWS (DynamoDB + Cognito).

## Features
- **Calendar** (month/week): planned workouts (dashed) vs. done (solid), "needs review" for past plans you never logged, drag to reschedule (keeps "moved from"), and copy or repeat a week.
- **Plan vs. actual** on every workout, with structured intervals (reps × work/rest + warm-up/cool-down; the total is calculated for you), status (completed / partial / skipped / missed / did something else), effort, pain, and a linked injury.
- **Day notes** and an optional per-account **drinks** counter (turn it on in Settings).
- **Injuries**: date ranges shown as stripes on the calendar, plus a pain timeline from linked workouts.
- **Benchmarks**: PBs for anything measurable (time, distance, weight × reps scored as estimated 1RM, reps, duration, or a custom unit), built-in suggestions, charts.

## Architecture
- `app/`: App Router pages (Cache Components on; session reads stream inside `<Suspense>`). `proxy.ts` does the optimistic auth redirect.
- `lib/auth/`: Cognito OIDC (auth code + PKCE via `openid-client`), with sessions in a signed HTTP-only cookie (`jose`).
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

Env vars: `APP_AWS_REGION`, `APP_AWS_ROLE_ARN` (Vercel only), `TABLE_NAME`, `COGNITO_ISSUER`, `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AUTH_SECRET`.

## Users
Sign-up is invite-only. To add someone:
```bash
aws cognito-idp admin-create-user --user-pool-id us-east-1_Qn070C54V --username friend@example.com \
  --user-attributes Name=email,Value=friend@example.com Name=email_verified,Value=true Name=given_name,Value=Friend
```
Cognito emails them a temporary password. To open self sign-up instead, set `"selfSignUp": true` in `infra/cdk.json` and redeploy the infra.

## Infra changes
```bash
cd infra && npm install && npm run deploy
```
To allow a new domain to sign in, add it to `appUrls` in `infra/cdk.json` and redeploy.

## Tests
```bash
npm test
```
