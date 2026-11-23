import { confirmInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import * as cognito from "@/lib/auth/cognito";
import { limitAuthEmail } from "@/lib/auth/limits";
import { appSession, cognitoCall, passwordLogin } from "@/lib/auth/login";

/**
 * POST /api/v1/auth/confirm — { email, password, code } → { token, expiresIn, user }. Confirms the
 * emailed code, then signs straight in (the app still holds the password from sign-up).
 */
export const POST = publicApi(async ({ body }) => {
  const { email, password, code } = confirmInput.parse(body);
  await limitAuthEmail(email);
  await cognitoCall(() => cognito.confirmSignUp(email, code));
  return appSession(await cognitoCall(() => passwordLogin(email, password), email));
});
