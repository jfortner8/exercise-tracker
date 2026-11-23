import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { clientIp } from "@et/core/api-input";
import { todayIn, userZone } from "@et/core/domain";
import { ApiError } from "@/lib/api-error";
import { userFromRequest } from "@/lib/api-auth";
import { limitAuthIp } from "@/lib/auth/limits";
import { getProfile } from "@/lib/db/repo";
import { rateLimit } from "@/lib/rate-limit";

/*
 * The shape every /api/v1 route shares: sign-in check, a per-user write limit, the JSON body,
 * "today" where the user is, and errors as JSON. Routes stay a few lines that call lib/services.
 */

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Writes per user per minute. Generous for a person, low enough to stop a runaway client. */
const WRITES_PER_MINUTE = 120;

export interface ApiContext<P> {
  req: NextRequest;
  sub: string;
  email: string;
  /** The name given at sign-up, if any. */
  name?: string;
  params: P;
  /** The parsed JSON body (unvalidated: services validate with @et/core/schemas). */
  body: unknown;
  /** Today's date where the user is: the X-Time-Zone header, else the profile's zone. */
  today: () => Promise<string>;
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

/** Turns anything thrown into a JSON error response. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, err.status);
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return json({ error: issue?.message ?? "Please check what you entered.", field: issue?.path.join(".") || undefined }, 400);
  }
  console.error("API error", err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/** Wraps a signed-in route. `fn` returns the response data (undefined → {ok: true}). */
export function api<P = Record<string, string>>(fn: (ctx: ApiContext<P>) => Promise<unknown>) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    try {
      const user = await userFromRequest(req);
      if (!user) return json({ error: "Sign in again.", code: "UNAUTHENTICATED" }, 401);
      const write = req.method !== "GET" && req.method !== "HEAD";
      if (write) await rateLimit(`user:${user.sub}`, WRITES_PER_MINUTE, 60);
      let body: unknown;
      if (write && req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json().catch(() => {
          throw new ApiError(400, "The request body isn't valid JSON.");
        });
      }
      let today: string | undefined;
      const result = await fn({
        req,
        sub: user.sub,
        email: user.email,
        name: user.name,
        params: await route.params,
        body,
        today: async () =>
          (today ??= todayIn(userZone(req.headers.get("x-time-zone") ?? undefined, (await getProfile(user.sub))?.timeZone))),
      });
      return json(result ?? { ok: true });
    } catch (err) {
      // Next's own control-flow errors (e.g. "this route is dynamic") must reach Next, not become a 500.
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

/**
 * Wraps a route anyone may call (sign-in, sign-up, passwords): the per-IP auth limit first, then the
 * JSON body, then `fn`, with errors as JSON like api(). `fn` adds the per-email limit once it has
 * the address.
 */
export function publicApi(fn: (ctx: { req: NextRequest; body: unknown }) => Promise<unknown>) {
  return async (req: NextRequest) => {
    try {
      await limitAuthIp(clientIp(req.headers.get("x-forwarded-for")));
      const body = await req.json().catch(() => {
        throw new ApiError(400, "The request body isn't valid JSON.");
      });
      return json((await fn({ req, body })) ?? { ok: true });
    } catch (err) {
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

/** Reads a field from a JSON body object, or undefined. */
export function field<T = unknown>(body: unknown, key: string): T | undefined {
  return body && typeof body === "object" ? ((body as Record<string, unknown>)[key] as T | undefined) : undefined;
}
