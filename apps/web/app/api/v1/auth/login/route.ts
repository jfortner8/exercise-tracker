import { signInInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import { limitAuthEmail } from "@/lib/auth/limits";
import { appSession, cognitoCall, passwordLogin } from "@/lib/auth/login";

/**
 * POST /api/v1/auth/login — { email, password } → { token, expiresIn, user }. The app keeps the token
 * in the phone's secure storage and sends it as "Authorization: Bearer <token>". 401 for a wrong
 * email or password; 403 { code: "UNCONFIRMED" } when the email isn't confirmed yet (a fresh code is
 * sent, so go to the confirm step). Same messages as the website.
 */
export const POST = publicApi(async ({ body }) => {
  const { email, password } = signInInput.parse(body);
  await limitAuthEmail(email);
  return appSession(await cognitoCall(() => passwordLogin(email, password), email));
});
