import { emailOnlyInput } from "@et/core/schemas";
import { publicApi } from "@/lib/api";
import * as cognito from "@/lib/auth/cognito";
import { limitAuthEmail } from "@/lib/auth/limits";
import { cognitoCall } from "@/lib/auth/login";

/**
 * POST /api/v1/auth/forgot — { email } → { ok: true }: emails a reset code, then POST /auth/reset.
 * The answer is the same whether or not the email has an account, so it can't be used to find out.
 */
export const POST = publicApi(async ({ body }) => {
  const { email } = emailOnlyInput.parse(body);
  await limitAuthEmail(email);
  await cognitoCall(() =>
    cognito.forgotPassword(email).catch((err) => {
      if (!(err instanceof Error && err.name === "UserNotFoundException")) throw err;
    }),
  );
});
