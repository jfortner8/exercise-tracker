import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "et_session";
export const FLOW_COOKIE = "et_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  sub: string;
  email: string;
  name?: string;
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(env.authSecret);
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, env.authSecret, { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

/** Short-lived signed cookie carrying PKCE verifier + state through the redirect. */
export async function signFlow(data: { verifier: string; state: string; nonce: string }) {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(env.authSecret);
}

export async function verifyFlow(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, env.authSecret, { algorithms: ["HS256"] });
    return payload as unknown as { verifier: string; state: string; nonce: string };
  } catch {
    return null;
  }
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
