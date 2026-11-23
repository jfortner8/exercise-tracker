import { signUpInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import * as cognito from "@/lib/auth/cognito";
import { limitAuthEmail } from "@/lib/auth/limits";
import { cognitoCall } from "@/lib/auth/login";

/**
 * POST /api/v1/auth/signup — { name?, email, password } → { ok: true }. Cognito emails a code; then
 * POST /auth/confirm. 409 if the email already has an account. Passwords need at least 10 characters.
 */
export const POST = publicApi(async ({ body }) => {
  const { name, email, password } = signUpInput.parse(body);
  await limitAuthEmail(email);
  await cognitoCall(() => cognito.signUp(email, password, name || undefined));
});
