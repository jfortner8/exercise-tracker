import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// POST so a cross-site link/image can't sign the user out.
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
