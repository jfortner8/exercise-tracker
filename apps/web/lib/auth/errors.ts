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
