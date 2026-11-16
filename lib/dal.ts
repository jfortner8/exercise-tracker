import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { defaultProfile, getProfile } from "@/lib/db/repo";

/** The signed-in user, or redirect to /login. The only source of userId for data access. */
export const requireUser = cache(async () => {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return user;
});

export const requireProfile = cache(async () => {
  const user = await requireUser();
  const profile = (await getProfile(user.sub)) ?? defaultProfile(user.email, user.name);
  return { user, profile: { ...profile, email: user.email } };
});
