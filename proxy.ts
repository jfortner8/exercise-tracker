import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

// Optimistic check only (cookie present). Real verification happens in lib/dal.ts.
export function proxy(req: NextRequest) {
  // (No "signed in → leave auth pages" redirect: a stale cookie would loop with dal.ts.)
  if (!req.cookies.has("et_session") && !AUTH_PAGES.includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // /api/v1 is the phone app's API: it checks its own Bearer token and answers 401, never a redirect.
  matcher: ["/((?!api/auth|api/v1/|cal/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
};
