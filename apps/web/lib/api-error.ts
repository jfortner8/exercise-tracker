/**
 * An error meant for the user: its message is shown as is, and API routes answer with `status`.
 * Server actions see an ordinary Error, so the website's error handling is unchanged.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} not found`);
