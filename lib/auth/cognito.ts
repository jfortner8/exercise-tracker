import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

// These are Cognito's public (unsigned) API operations: they need the app client ID
// (and SECRET_HASH, since our client has a secret), not IAM credentials. Placeholder
// credentials stop the SDK from probing the default credential chain.
let client: CognitoIdentityProviderClient | null = null;
const cognito = () =>
  (client ??= new CognitoIdentityProviderClient({
    region: env.region,
    credentials: { accessKeyId: "unused", secretAccessKey: "unused" },
  }));

/** base64(HMAC-SHA256(clientSecret, username + clientId)), required when the app client has a secret. */
function secretHash(username: string) {
  return createHmac("sha256", env.cognitoClientSecret)
    .update(username + env.cognitoClientId)
    .digest("base64");
}

const normalize = (email: string) => email.trim().toLowerCase();

export async function signUp(email: string, password: string, name?: string) {
  const username = normalize(email);
  const attrs = [{ Name: "email", Value: username }];
  if (name) attrs.push({ Name: "given_name", Value: name });
  await cognito().send(
    new SignUpCommand({
      ClientId: env.cognitoClientId,
      SecretHash: secretHash(username),
      Username: username,
      Password: password,
      UserAttributes: attrs,
    }),
  );
}

export async function confirmSignUp(email: string, code: string) {
  const username = normalize(email);
  await cognito().send(
    new ConfirmSignUpCommand({
      ClientId: env.cognitoClientId,
      SecretHash: secretHash(username),
      Username: username,
      ConfirmationCode: code.trim(),
    }),
  );
}

export async function resendCode(email: string) {
  const username = normalize(email);
  await cognito().send(
    new ResendConfirmationCodeCommand({
      ClientId: env.cognitoClientId,
      SecretHash: secretHash(username),
      Username: username,
    }),
  );
}

export async function forgotPassword(email: string) {
  const username = normalize(email);
  await cognito().send(
    new ForgotPasswordCommand({ ClientId: env.cognitoClientId, SecretHash: secretHash(username), Username: username }),
  );
}

export async function confirmForgotPassword(email: string, code: string, password: string) {
  const username = normalize(email);
  await cognito().send(
    new ConfirmForgotPasswordCommand({
      ClientId: env.cognitoClientId,
      SecretHash: secretHash(username),
      Username: username,
      ConfirmationCode: code.trim(),
      Password: password,
    }),
  );
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Password sign-in. Returns the verified identity from Cognito's ID token. */
export async function signIn(email: string, password: string) {
  const username = normalize(email);
  const res = await cognito().send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: env.cognitoClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password, SECRET_HASH: secretHash(username) },
    }),
  );
  const idToken = res.AuthenticationResult?.IdToken;
  if (!idToken) {
    // e.g. a NEW_PASSWORD_REQUIRED challenge for admin-created users
    const err = new Error(res.ChallengeName ?? "NoTokens");
    err.name = res.ChallengeName === "NEW_PASSWORD_REQUIRED" ? "NewPasswordRequired" : "NoTokens";
    throw err;
  }
  jwks ??= createRemoteJWKSet(new URL(`${env.cognitoIssuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: env.cognitoIssuer,
    audience: env.cognitoClientId,
  });
  if (!payload.sub || typeof payload.email !== "string") throw new Error("Cognito ID token missing claims");
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.given_name === "string" ? payload.given_name : undefined,
  };
}
