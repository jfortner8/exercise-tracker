import { resetPasswordInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import * as cognito from "@/lib/auth/cognito";
import { limitAuthEmail } from "@/lib/auth/limits";
import { appSession, cognitoCall, passwordLogin } from "@/lib/auth/login";

/**
 * POST /api/v1/auth/reset — { email, code, password } → { token, expiresIn, user }. Sets the new
 * password with the emailed code, then signs straight in.
 */
export const POST = publicApi(async ({ body }) => {
  const { email, code, password } = resetPasswordInput.parse(body);
  await limitAuthEmail(email);
  await cognitoCall(() => cognito.confirmForgotPassword(email, code, password));
  return appSession(await cognitoCall(() => passwordLogin(email, password), email));
});
