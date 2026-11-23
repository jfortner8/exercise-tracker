import "server-only";
import type { AuthSession } from "@et/core/api-types";
import { ApiError } from "@/lib/api-error";
import { ensureProfile } from "@/lib/db/repo";
import * as cognito from "./cognito";
import { authApiError } from "./errors";
import { SESSION_MAX_AGE, signSession, type SessionUser } from "./session";

export { emailField, passwordField } from "@et/core/schemas";

/**
 * Checks an email and password with Cognito and makes sure the user has a profile. Shared by the
 * website's sign-in (which sets the session cookie) and the app's login endpoint (which returns it).
 */
export async function passwordLogin(email: string, password: string) {
  const user = await cognito.signIn(email, password);
  await ensureProfile(user.sub, user.email, user.name);
  return user;
}

/** What the app keeps after signing in: the session token (sent as "Authorization: Bearer"), how long it lasts, and who. */
export async function appSession(user: SessionUser): Promise<AuthSession> {
  return { token: await signSession(user), expiresIn: SESSION_MAX_AGE, user };
}

/**
 * Runs a Cognito call for /api/v1, turning its errors into ApiErrors with the website's messages.
 * An unconfirmed email gets a fresh code, so the app's confirm step works straight away.
 */
export async function cognitoCall<T>(fn: () => Promise<T>, email?: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (email && err instanceof Error && err.name === "UserNotConfirmedException") await cognito.resendCode(email).catch(() => {});
    throw authApiError(err);
  }
}
