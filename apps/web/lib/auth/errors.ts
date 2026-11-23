import { ApiError } from "../api-error";

const MESSAGES: Record<string, string> = {
  UsernameExistsException: "An account with that email already exists. Try signing in.",
  NotAuthorizedException: "Incorrect email or password.",
  UserNotFoundException: "Incorrect email or password.",
  UserNotConfirmedException: "Please confirm your email first.",
  CodeMismatchException: "That code isn't right. Check the email and try again.",
  ExpiredCodeException: "That code has expired. Request a new one.",
  InvalidParameterException: "Please check what you entered and try again.",
  LimitExceededException: "Too many attempts. Wait a few minutes and try again.",
  TooManyRequestsException: "Too many attempts. Wait a few minutes and try again.",
  TooManyFailedAttemptsException: "Too many attempts. Wait a few minutes and try again.",
  CodeDeliveryFailureException: "We couldn't send the email. Check the address and try again.",
  NewPasswordRequired: "You need to set a new password. Use “Forgot password” to choose one.",
};

export const PASSWORD_RULES = "At least 10 characters, with an uppercase letter, a lowercase letter, and a number.";

export function authErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : undefined;
  if (name === "InvalidPasswordException") return PASSWORD_RULES;
  const msg = name ? MESSAGES[name] : undefined;
  if (!msg) console.error("Unhandled auth error", err);
  return msg ?? "Something went wrong. Please try again.";
}

/** HTTP status for each Cognito error the API passes on; anything else is a 500. */
const STATUS: Record<string, number> = {
  UsernameExistsException: 409,
  NotAuthorizedException: 401,
  UserNotFoundException: 401,
  UserNotConfirmedException: 403,
  CodeMismatchException: 400,
  ExpiredCodeException: 400,
  InvalidParameterException: 400,
  InvalidPasswordException: 400,
  LimitExceededException: 429,
  TooManyRequestsException: 429,
  TooManyFailedAttemptsException: 429,
  CodeDeliveryFailureException: 400,
  NewPasswordRequired: 403,
};

/** A Cognito error as an ApiError for /api/v1, with the same message the website shows. */
export function authApiError(err: unknown): ApiError {
  const name = err instanceof Error ? err.name : "";
  const status = STATUS[name] ?? 500;
  const code = name === "UserNotConfirmedException" ? "UNCONFIRMED" : status === 429 ? "RATE_LIMITED" : undefined;
  return new ApiError(status, authErrorMessage(err), code);
}
