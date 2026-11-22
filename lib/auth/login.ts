import "server-only";
import { z } from "zod";
import { ensureProfile } from "@/lib/db/repo";
import * as cognito from "./cognito";

export const emailField = z.string().trim().email("Enter a valid email address.").max(254);
export const passwordField = z.string().min(1, "Enter your password.").max(256);

/**
 * Checks an email and password with Cognito and makes sure the user has a profile. Shared by the
 * website's sign-in (which sets the session cookie) and the app's login endpoint (which returns it).
 */
export async function passwordLogin(email: string, password: string) {
  const user = await cognito.signIn(email, password);
  await ensureProfile(user.sub, user.email, user.name);
  return user;
}
