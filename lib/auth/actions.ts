"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { ensureProfile } from "@/lib/db/repo";
import * as cognito from "./cognito";
import { authErrorMessage } from "./errors";
import { cookieBase, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./session";

export type AuthResult = { ok: true } | { ok: false; error: string; code?: "UNCONFIRMED" };

const email = z.string().trim().email("Enter a valid email address.").max(254);
const password = z.string().min(1, "Enter your password.").max(256);
const code = z.string().trim().regex(/^\d{4,8}$/, "Enter the code from the email.");

function bad(e: z.ZodError): AuthResult {
  return { ok: false, error: e.issues[0]?.message ?? "Please check what you entered." };
}

async function startSession(e: string, p: string): Promise<AuthResult> {
  const user = await cognito.signIn(e, p);
  await ensureProfile(user.sub, user.email, user.name);
  (await cookies()).set(SESSION_COOKIE, await signSession(user), { ...cookieBase, maxAge: SESSION_MAX_AGE });
  return { ok: true };
}

export async function signInAction(input: { email: string; password: string }): Promise<AuthResult> {
  const parsed = z.object({ email, password }).safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    return await startSession(parsed.data.email, parsed.data.password);
  } catch (err) {
    if (err instanceof Error && err.name === "UserNotConfirmedException") {
      // Send a fresh code so the confirm step works straight away.
      await cognito.resendCode(parsed.data.email).catch(() => {});
      return { ok: false, error: authErrorMessage(err), code: "UNCONFIRMED" };
    }
    return { ok: false, error: authErrorMessage(err) };
  }
}

export async function signUpAction(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const parsed = z
    .object({ name: z.string().trim().max(80), email, password: password.min(10, "Use at least 10 characters.") })
    .safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    await cognito.signUp(parsed.data.email, parsed.data.password, parsed.data.name || undefined);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}

/** Confirm the emailed code, then sign straight in (the client still holds the password). */
export async function confirmAndSignInAction(input: {
  email: string;
  password: string;
  code: string;
}): Promise<AuthResult> {
  const parsed = z.object({ email, password, code }).safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    await cognito.confirmSignUp(parsed.data.email, parsed.data.code);
    return await startSession(parsed.data.email, parsed.data.password);
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}

export async function resendCodeAction(input: { email: string }): Promise<AuthResult> {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    await cognito.resendCode(parsed.data.email);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}

export async function forgotPasswordAction(input: { email: string }): Promise<AuthResult> {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    await cognito.forgotPassword(parsed.data.email);
  } catch (err) {
    // Don't reveal whether an account exists.
    if (!(err instanceof Error && err.name === "UserNotFoundException")) {
      return { ok: false, error: authErrorMessage(err) };
    }
  }
  return { ok: true };
}

export async function resetPasswordAction(input: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = z
    .object({ email, code, password: password.min(10, "Use at least 10 characters.") })
    .safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  try {
    await cognito.confirmForgotPassword(parsed.data.email, parsed.data.code, parsed.data.password);
    return await startSession(parsed.data.email, parsed.data.password);
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}
