import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (cookie present). Real verification happens in lib/dal.ts.
export function proxy(req: NextRequest) {
  if (!req.cookies.has("et_session")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
