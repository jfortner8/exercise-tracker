import { useSyncExternalStore } from "react";
import { api, type ApiError } from "./client";
import { cacheStorage } from "./storage";

/*
 * Writes made without a connection: kept on the phone, in order, and sent when the server can be
 * reached again (at launch, when the app comes back to the front, every little while, and before
 * any new write, so nothing jumps the queue). A change the server then refuses (the workout was
 * deleted on the website meanwhile, say) is dropped and shown once, so the rest can go through.
 */

interface Pending {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  /** What it was, for the "waiting to sync" note: "Marked done". */
  label: string;
}

export interface Refused {
  label: string;
  message: string;
}

/** What `write` resolves to when the change was kept for later. */
export const QUEUED = Object.freeze({ queued: true as const });
export type Queued = typeof QUEUED;
export const isQueued = (r: unknown): r is Queued => r === QUEUED;

/** The server couldn't be reached at all (status 0), as opposed to answering with an error. */
const unreachable = (e: unknown) => (e as ApiError | undefined)?.status === 0;
/** Worth trying again later: unreachable, signed out, rate limited, or the server's own trouble. */
const retryLater = (e: unknown) => {
  const s = (e as ApiError | undefined)?.status;
  return s === undefined || s === 0 || s === 401 || s === 429 || s >= 500;
};

const KEY = "outbox";
let items: Pending[] = [];
let refused: Refused[] = [];
let loaded: Promise<void> | null = null;
let flushing: Promise<number> | null = null;
let snapshot = { pending: items, refused };
const listeners = new Set<() => void>();

function changed() {
  snapshot = { pending: items, refused };
  listeners.forEach((l) => l());
  void cacheStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}

function load() {
  loaded ??= cacheStorage
    .getItem(KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as Pending[]) : [];
      // Anything queued before this load comes after what was saved.
      items = [...saved, ...items];
      snapshot = { pending: items, refused };
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  return loaded;
}

/** A short name for a write, from its path: shown while it waits. */
export function describeWrite(path: string, method: string): string {
  if (path.endsWith("/quick-done")) return "Marked done";
  if (path.endsWith("/resolve")) return "Workout outcome";
  if (path.endsWith("/move") || path.endsWith("/swap")) return "Moved workout";
  if (path.startsWith("/weeks/copy")) return "Copied week";
  if (path.startsWith("/workouts")) return method === "DELETE" ? "Deleted workout" : "Workout";
  if (path.includes("/goals/")) return "Daily goal";
  if (path.endsWith("/rest")) return "Rest day";
  if (path.startsWith("/days/")) return "Day notes";
  if (path.includes("/results")) return method === "DELETE" ? "Deleted result" : "Benchmark result";
  if (path.startsWith("/injuries")) return "Injury";
  if (path.startsWith("/routines")) return "Routine";
  return "Change";
}

/**
 * Sends everything waiting, oldest first. Stops at the first one that still can't get through.
 * Resolves how many were sent (accepted or refused), so callers can refresh what's shown.
 */
export function flush(): Promise<number> {
  flushing ??= (async () => {
    await load();
    let sent = 0;
    while (items.length) {
      const next = items[0];
      try {
        await api(next.path, { method: next.method, body: next.body });
      } catch (e) {
        // Still offline, or signed out: try again later.
        if (retryLater(e)) break;
        refused = [...refused, { label: next.label, message: (e as ApiError).message }];
      }
      items = items.slice(1);
      sent++;
      changed();
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * A write that survives having no connection: sent now when possible, otherwise kept and sent
 * later (resolving QUEUED). Other errors (bad input, not found) throw as usual.
 */
export async function write<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T | Queued> {
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  await load();
  if (items.length) await flush();
  if (!items.length) {
    try {
      return await api<T>(path, init);
    } catch (e) {
      if (!unreachable(e)) throw e;
    }
  }
  items = [...items, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, method, body: init.body, label: describeWrite(path, method) }];
  changed();
  return QUEUED;
}

/** Forget everything waiting (signing out: it belongs to that account). */
export function clearOutbox() {
  items = [];
  refused = [];
  changed();
}

export function dismissRefused() {
  refused = [];
  changed();
}

/** What's waiting and what the server turned down, for the sync note. */
export const useOutbox = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
