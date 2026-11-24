import { ApiError, OFFLINE } from "../errors";

const mockStore = new Map<string, string>();
jest.mock("../storage", () => ({
  cacheStorage: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    removeItem: async (k: string) => void mockStore.delete(k),
  },
}));

const mockApi = jest.fn();
jest.mock("../client", () => {
  const errors = jest.requireActual("../errors");
  return { api: (...a: unknown[]) => mockApi(...a), ApiError: errors.ApiError };
});

// A fresh module (and queue) per test.
const load = () => {
  let m!: typeof import("../outbox");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy of the module per test
    m = require("../outbox");
  });
  return m;
};

beforeEach(() => {
  mockStore.clear();
  mockApi.mockReset();
});

describe("outbox", () => {
  it("sends straight away when online", async () => {
    const o = load();
    mockApi.mockResolvedValue({ ok: true });
    await expect(o.write("/days/2026-11-23", { method: "PUT", body: { notes: "x" } })).resolves.toEqual({ ok: true });
    expect(o.isQueued(await o.write("/x", { body: {} }))).toBe(false);
  });

  it("keeps a write made offline, in order, and sends them all once back online", async () => {
    const o = load();
    mockApi.mockRejectedValue(OFFLINE);
    expect(o.isQueued(await o.write("/workouts/2026-11-23/a/quick-done", { body: { extraAs: "cooldown" } }))).toBe(true);
    // Still offline: the next write queues behind it without jumping ahead.
    expect(o.isQueued(await o.write("/days/2026-11-23/goals/stretch", { method: "PUT", body: { done: true } }))).toBe(true);
    expect(JSON.parse(mockStore.get("outbox")!).map((p: { label: string }) => p.label)).toEqual(["Marked done", "Daily goal"]);

    mockApi.mockReset();
    mockApi.mockResolvedValue({ ok: true });
    await expect(o.flush()).resolves.toBe(2);
    expect(mockApi.mock.calls.map((c) => c[0])).toEqual(["/workouts/2026-11-23/a/quick-done", "/days/2026-11-23/goals/stretch"]);
    expect(mockApi.mock.calls[1][1]).toEqual({ method: "PUT", body: { done: true } });
    expect(JSON.parse(mockStore.get("outbox")!)).toEqual([]);
  });

  it("drops a change the server refuses, notes it, and carries on with the rest", async () => {
    const o = load();
    mockApi.mockRejectedValue(OFFLINE);
    await o.write("/workouts/2026-11-23/gone/resolve", { body: { status: "missed" } });
    await o.write("/days/2026-11-23/rest", { method: "POST" });
    mockApi.mockReset();
    mockApi.mockRejectedValueOnce(new ApiError(404, "Workout not found")).mockResolvedValue({ ok: true });
    await expect(o.flush()).resolves.toBe(2);
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it("stops at the first change that still can't get through, and keeps it", async () => {
    const o = load();
    mockApi.mockRejectedValue(OFFLINE);
    await o.write("/days/2026-11-23", { method: "PUT", body: { notes: "a" } });
    await expect(o.flush()).resolves.toBe(0);
    expect(JSON.parse(mockStore.get("outbox")!)).toHaveLength(1);
  });

  it("picks up what an earlier launch left behind", async () => {
    mockStore.set("outbox", JSON.stringify([{ id: "1", path: "/days/2026-11-20/rest", method: "POST", label: "Rest day" }]));
    const o = load();
    mockApi.mockResolvedValue({ ok: true });
    await expect(o.flush()).resolves.toBe(1);
    expect(mockApi).toHaveBeenCalledWith("/days/2026-11-20/rest", { method: "POST", body: undefined });
  });

  it("forgets everything on sign out", async () => {
    const o = load();
    mockApi.mockRejectedValue(OFFLINE);
    await o.write("/days/2026-11-23/rest", { method: "POST" });
    o.clearOutbox();
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(mockStore.get("outbox")!)).toEqual([]);
  });
});
