import type { ApiErrorBody } from "@et/core/api-types";

/** An error from the API, with its message ready to show. `status` 0 means the server couldn't be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turns a failed response's body (whatever it was) into an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body && typeof body === "object" ? body : {}) as Partial<ApiErrorBody>;
  const message =
    typeof b.error === "string" && b.error
      ? b.error
      : status === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : "Something went wrong. Please try again.";
  return new ApiError(status, message, b.code, b.field);
}

export const OFFLINE = new ApiError(0, "Can't reach Exercise Tracker. Check your connection and try again.");
