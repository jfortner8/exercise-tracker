import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";
import { callbackUrl, oidcConfig } from "@/lib/auth/oidc";
import { cookieBase, FLOW_COOKIE, signFlow } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const config = await oidcConfig();
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl(req.nextUrl.origin),
    scope: "openid email profile",
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(FLOW_COOKIE, await signFlow({ verifier, state, nonce }), { ...cookieBase, maxAge: 600 });
  return res;
}
