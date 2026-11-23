import { emailOnlyInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import * as cognito from "@/lib/auth/cognito";
import { limitAuthEmail } from "@/lib/auth/limits";
import { cognitoCall } from "@/lib/auth/login";

/** POST /api/v1/auth/resend — { email } → { ok: true }: a new confirmation code. */
export const POST = publicApi(async ({ body }) => {
  const { email } = emailOnlyInput.parse(body);
  await limitAuthEmail(email);
  await cognitoCall(() => cognito.resendCode(email));
});
