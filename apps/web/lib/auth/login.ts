import "server-only";
import { ensureProfile } from "@/lib/db/repo";
import * as cognito from "./cognito";

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
