import "server-only";
import { rateLimit } from "@/lib/rate-limit";

/*
 * Limits on the sign-in, sign-up and password endpoints, which anyone can call without being signed
 * in. Counted before Cognito is asked, so they also cap how many codes anyone can make Cognito email.
 * Shared by the website's auth actions and the /api/v1/auth routes. Cognito has limits of its own.
 */

const WINDOW_SEC = 10 * 60;
const MESSAGE = "Too many attempts. Wait a few minutes and try again.";

/** 30 attempts per 10 minutes from one IP address, across every auth endpoint (shared Wi-Fi included). */
export const limitAuthIp = (ip: string) => rateLimit(`auth-ip:${ip}`, 30, WINDOW_SEC, MESSAGE);

/** 10 attempts per 10 minutes for one email address, wherever they come from. */
export const limitAuthEmail = (email: string) => rateLimit(`auth-email:${email.trim().toLowerCase()}`, 10, WINDOW_SEC, MESSAGE);
