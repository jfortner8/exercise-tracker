import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiError } from "./errors";

/**
 * Runs one write at a time for a screen: shows it's busy, keeps the error or the server's message
 * to show, and refreshes the queries it touched. `run` resolves to the result, or undefined on error.
 */
export function useAction(invalidate: QueryKey[] = []) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run<T>(f: () => Promise<T>, done?: string | ((r: T) => string | undefined)): Promise<T | undefined> {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const r = await f();
      setMessage((typeof done === "function" ? done(r) : done) ?? null);
      await Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })));
      return r;
    } catch (e) {
      setError((e as ApiError).message ?? "Something went wrong. Try again.");
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, message, clear: () => (setError(null), setMessage(null)) };
}
