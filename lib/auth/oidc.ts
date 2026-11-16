import "server-only";
import * as client from "openid-client";
import { env } from "@/lib/env";

let configPromise: Promise<client.Configuration> | null = null;

export function oidcConfig() {
  configPromise ??= client
    .discovery(new URL(env.cognitoIssuer), env.cognitoClientId, undefined, client.ClientSecretBasic(env.cognitoClientSecret))
    .catch((e) => {
      configPromise = null;
      throw e;
    });
  return configPromise;
}

export const callbackUrl = (origin: string) => `${origin}/api/auth/callback`;

export function cognitoLogoutUrl(origin: string) {
  const u = new URL(`${env.cognitoDomain}/logout`);
  u.searchParams.set("client_id", env.cognitoClientId);
  u.searchParams.set("logout_uri", `${origin}/login`);
  return u.toString();
}
