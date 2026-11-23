import * as Localization from "expo-localization";
import { API_URL } from "@/config";
import { OFFLINE, toApiError } from "./errors";

export { ApiError } from "./errors";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Set by the session provider: the token to send, and what to do when the API says it's no good. */
export function configureClient(t: string | null, unauthorized: (() => void) | null) {
  token = t;
  onUnauthorized = unauthorized;
}

/** The phone's time zone, which decides "today" on the server (rest days, the calendar, Consistency). */
export function deviceTimeZone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function requestHeaders(opts: { token: string | null; timeZone: string; json: boolean }): Record<string, string> {
  return {
    Accept: "application/json",
    "X-Time-Zone": opts.timeZone,
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.json ? { "Content-Type": "application/json" } : {}),
  };
}

/** Calls /api/v1. Throws ApiError with a message to show; a 401 signs the app out. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const json = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: init.method ?? (json ? "POST" : "GET"),
      headers: requestHeaders({ token, timeZone: deviceTimeZone(), json }),
      body: json ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw OFFLINE;
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw toApiError(res.status, data);
  }
  return data as T;
}
