import "server-only";
import { AdminDeleteUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { awsCredentials } from "@/lib/db/client";
import { env } from "@/lib/env";

/*
 * Cognito's admin operations. Unlike sign-in (lib/auth/cognito.ts), these need IAM credentials:
 * infra/ grants the Vercel role cognito-idp:AdminDeleteUser on the pool.
 */

let client: CognitoIdentityProviderClient | null = null;
const admin = () => (client ??= new CognitoIdentityProviderClient({ region: env.region, credentials: awsCredentials() }));

/** The pool id is the last part of the issuer: https://cognito-idp.<region>.amazonaws.com/<poolId>. */
const poolId = () => new URL(env.cognitoIssuer).pathname.replace(/^\//, "");

/** Deletes the sign-in itself. Already gone counts as done, so a retried deletion finishes. */
export async function deleteCognitoUser(sub: string) {
  try {
    // The pool signs in by email, so Cognito's username for each user is their sub.
    await admin().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: sub }));
  } catch (e) {
    if ((e as Error).name !== "UserNotFoundException") throw e;
  }
}
