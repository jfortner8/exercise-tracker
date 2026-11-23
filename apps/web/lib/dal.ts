import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { defaultProfile, getProfile } from "@/lib/db/repo";
import { todayIn, TZ_COOKIE, userZone } from "@et/core/domain";

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

/**
 * The user's time zone: where their browser is now (the tz cookie), else their profile's. The server
 * runs in UTC, so anything that needs "today" asks this rather than reading the server's clock.
 */
export const requireZone = cache(async () => {
  const [{ profile }, jar] = await Promise.all([requireProfile(), cookies()]);
  return userZone(jar.get(TZ_COOKIE)?.value, profile.timeZone);
});

/** Today's date (YYYY-MM-DD) where the user is. */
export const requireToday = cache(async () => todayIn(await requireZone()));
