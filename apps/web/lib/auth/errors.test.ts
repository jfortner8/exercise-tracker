import { describe, expect, it } from "vitest";
import { authApiError, authErrorMessage, PASSWORD_RULES } from "./errors";

const cognitoError = (name: string) => Object.assign(new Error("from Cognito"), { name });

describe("authApiError", () => {
  it("passes the website's message on with a matching status", () => {
    for (const [name, status] of [
      ["NotAuthorizedException", 401],
      ["UsernameExistsException", 409],
      ["CodeMismatchException", 400],
      ["ExpiredCodeException", 400],
    ] as const) {
      const e = authApiError(cognitoError(name));
      expect(e.status).toBe(status);
      expect(e.message).toBe(authErrorMessage(cognitoError(name)));
    }
  });

  it("marks an unconfirmed email so the app can go to the confirm step", () => {
    const e = authApiError(cognitoError("UserNotConfirmedException"));
    expect([e.status, e.code]).toEqual([403, "UNCONFIRMED"]);
  });

  it("marks Cognito's own throttling as rate limited", () => {
    const e = authApiError(cognitoError("LimitExceededException"));
    expect([e.status, e.code]).toEqual([429, "RATE_LIMITED"]);
  });

  it("gives the password rules for a weak password", () => {
    const e = authApiError(cognitoError("InvalidPasswordException"));
    expect([e.status, e.message]).toEqual([400, PASSWORD_RULES]);
  });

  it("treats anything unknown as a 500 with a generic message", () => {
    const e = authApiError(new Error("network down"));
    expect([e.status, e.message]).toEqual([500, "Something went wrong. Please try again."]);
  });
});
