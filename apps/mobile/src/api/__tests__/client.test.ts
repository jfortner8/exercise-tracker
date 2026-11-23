import { requestHeaders } from "../client";

jest.mock("expo-localization", () => ({ getCalendars: () => [{ timeZone: "America/Chicago" }] }));

describe("requestHeaders", () => {
  it("always sends the time zone, and the token when signed in", () => {
    expect(requestHeaders({ token: "t0k", timeZone: "America/Chicago", json: true })).toEqual({
      Accept: "application/json",
      "X-Time-Zone": "America/Chicago",
      Authorization: "Bearer t0k",
      "Content-Type": "application/json",
    });
  });

  it("leaves out Authorization when signed out and Content-Type without a body", () => {
    const h = requestHeaders({ token: null, timeZone: "UTC", json: false });
    expect(h.Authorization).toBeUndefined();
    expect(h["Content-Type"]).toBeUndefined();
  });
});
