"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@et/core/api-input";
import { ApiError } from "@/lib/api-error";
import { limitAuthEmail, limitAuthIp } from "./limits";
import * as cognito from "./cognito";
import { authErrorMessage } from "./errors";
import { passwordLogin } from "./login";
import { confirmInput, emailOnlyInput, resetPasswordInput, signInInput, signUpInput } from "@et/core/schemas";
import { cookieBase, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./session";

export type AuthResult = { ok: true } | { ok: false; error: string; code?: "UNCONFIRMED" };

function bad(e: z.ZodError): AuthResult {
  return { ok: false, error: e.issues[0]?.message ?? "Please check what you entered." };
}

/** The same limits as /api/v1/auth: per IP, then per email. Past either, an error to show. */
async function limited(email: string): Promise<AuthResult | null> {
  try {
    await limitAuthIp(clientIp((await headers()).get("x-forwarded-for")));
    await limitAuthEmail(email);
    return null;
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message };
    throw e;
  }
}

async function startSession(e: string, p: string): Promise<AuthResult> {
  const user = await passwordLogin(e, p);
  (await cookies()).set(SESSION_COOKIE, await signSession(user), { ...cookieBase, maxAge: SESSION_MAX_AGE });
  return { ok: true };
}

export async function signInAction(input: { email: string; password: string }): Promise<AuthResult> {
  const parsed = signInInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
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
  const parsed = signUpInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
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
  const parsed = confirmInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
  try {
    await cognito.confirmSignUp(parsed.data.email, parsed.data.code);
    return await startSession(parsed.data.email, parsed.data.password);
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}

export async function resendCodeAction(input: { email: string }): Promise<AuthResult> {
  const parsed = emailOnlyInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
  try {
    await cognito.resendCode(parsed.data.email);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}

export async function forgotPasswordAction(input: { email: string }): Promise<AuthResult> {
  const parsed = emailOnlyInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
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
  const parsed = resetPasswordInput.safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const stop = await limited(parsed.data.email);
  if (stop) return stop;
  try {
    await cognito.confirmForgotPassword(parsed.data.email, parsed.data.code, parsed.data.password);
    return await startSession(parsed.data.email, parsed.data.password);
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
}
