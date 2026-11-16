import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";
import { callbackUrl, oidcConfig } from "@/lib/auth/oidc";
import {
  cookieBase,
  FLOW_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifyFlow,
} from "@/lib/auth/session";
import { ensureProfile } from "@/lib/db/repo";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (why: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(why)}`, origin));
    res.cookies.delete(FLOW_COOKIE);
    return res;
  };

  const flow = await verifyFlow(req.cookies.get(FLOW_COOKIE)?.value);
  if (!flow) return fail("expired");

  try {
    const config = await oidcConfig();
    // Rebuild the URL against the public origin so redirect_uri matches exactly.
    const current = new URL(`${callbackUrl(origin)}${req.nextUrl.search}`);
    const tokens = await client.authorizationCodeGrant(config, current, {
      pkceCodeVerifier: flow.verifier,
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims?.sub || typeof claims.email !== "string") return fail("claims");

    const name =
      (typeof claims.given_name === "string" && claims.given_name) ||
      (typeof claims.name === "string" && claims.name) ||
      undefined;
    await ensureProfile(claims.sub, claims.email, name);

    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.delete(FLOW_COOKIE);
    res.cookies.set(SESSION_COOKIE, await signSession({ sub: claims.sub, email: claims.email, name }), {
      ...cookieBase,
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    console.error("OIDC callback failed", e);
    return fail("callback");
  }
}
