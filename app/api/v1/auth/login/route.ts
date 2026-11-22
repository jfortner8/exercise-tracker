import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resendCode } from "@/lib/auth/cognito";
import { authErrorMessage } from "@/lib/auth/errors";
import { emailField, passwordField, passwordLogin } from "@/lib/auth/login";
import { SESSION_MAX_AGE, signSession } from "@/lib/auth/session";

const noStore = { "Cache-Control": "no-store" };

/**
 * App sign-in. POST {email, password} → {token, expiresIn, user}. The app keeps the token in the
 * phone's secure storage and sends it as "Authorization: Bearer <token>". Same messages as the website.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ email: emailField, password: passwordField }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check what you entered." }, { status: 400, headers: noStore });
  }
  try {
    const user = await passwordLogin(parsed.data.email, parsed.data.password);
    return NextResponse.json({ token: await signSession(user), expiresIn: SESSION_MAX_AGE, user }, { headers: noStore });
  } catch (err) {
    if (err instanceof Error && err.name === "UserNotConfirmedException") {
      // Send a fresh code so the app's confirm step works straight away, as the website does.
      await resendCode(parsed.data.email).catch(() => {});
      return NextResponse.json({ error: authErrorMessage(err), code: "UNCONFIRMED" }, { status: 403, headers: noStore });
    }
    return NextResponse.json({ error: authErrorMessage(err) }, { status: 401, headers: noStore });
  }
}
