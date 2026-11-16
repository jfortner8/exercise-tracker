import { NextResponse, type NextRequest } from "next/server";
import { cognitoLogoutUrl } from "@/lib/auth/oidc";
import { SESSION_COOKIE } from "@/lib/auth/session";

// POST so a cross-site link/image can't sign the user out.
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(cognitoLogoutUrl(req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
