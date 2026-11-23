import { toApiError } from "../errors";

describe("toApiError", () => {
  it("keeps the API's message, code and field", () => {
    const e = toApiError(400, { error: "Use at least 10 characters.", field: "password" });
    expect([e.status, e.message, e.field]).toEqual([400, "Use at least 10 characters.", "password"]);
  });

  it("keeps the code the app acts on", () => {
    expect(toApiError(403, { error: "Please confirm your email first.", code: "UNCONFIRMED" }).code).toBe("UNCONFIRMED");
  });

  it("explains a 429 without a body", () => {
    expect(toApiError(429, null).message).toMatch(/Too many attempts/);
  });

  it("falls back to a generic message for anything else", () => {
    expect(toApiError(502, "<html>Bad gateway</html>").message).toBe("Something went wrong. Please try again.");
  });
});
