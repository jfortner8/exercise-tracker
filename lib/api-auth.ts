import "server-only";
import type { NextRequest } from "next/server";
import { bearerToken } from "./api-input";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./auth/session";

/**
 * The signed-in user for an API request: the phone app sends its session token as
 * "Authorization: Bearer <token>"; the website's session cookie works too. Null when neither is valid.
 * The token is the same signed session the website keeps in its cookie (lib/auth/session.ts).
 */
export async function userFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (header) return verifySession(bearerToken(header));
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}
