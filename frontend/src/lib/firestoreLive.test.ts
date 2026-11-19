import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<{
    next: (snapshot: unknown) => void;
    error: (error: unknown) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ path: "collection" })),
  onSnapshot: vi.fn((_ref: unknown, next: (snapshot: unknown) => void, error: (error: unknown) => void) => {
    const listener = { next, error, unsubscribe: vi.fn() };
    mocks.listeners.push(listener);
    return listener.unsubscribe;
  }),
}));

import { liveRows, stopLiveListeners } from "./firestoreLive";

function snapshot(rows: Array<Record<string, unknown>>, fromCache: boolean) {
  return {
    metadata: { fromCache },
    docChanges: () => rows.map((row) => ({
      type: "added",
      doc: { id: String(row.id), data: () => row },
    })),
  };
}

beforeEach(() => {
  // The shared listener is disabled in test mode; enable it for these unit tests.
  vi.stubEnv("MODE", "development");
  mocks.listeners.length = 0;
});

afterEach(() => {
  stopLiveListeners();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("liveRows fast reads", () => {
  it("returns rows from the first cached snapshot without waiting for the server", async () => {
    const pending = liveRows("owner-a", "tasks", 350);
    expect(mocks.listeners).toHaveLength(1);

    mocks.listeners[0].next(snapshot([{ id: "t1", title: "cached task" }], true));

    await expect(pending).resolves.toEqual([{ id: "t1", title: "cached task" }]);
  });

  it("falls through to a direct read when no snapshot arrives within the grace period", async () => {
    vi.useFakeTimers();
    const pending = liveRows("owner-b", "tasks", 350);
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
    // The listener keeps warming up for later calls.
    expect(mocks.listeners).toHaveLength(1);
    expect(mocks.listeners[0].unsubscribe).not.toHaveBeenCalled();
  });

  it("returns an empty array once the server confirms the collection is empty", async () => {
    vi.useFakeTimers();
    const pending = liveRows("owner-c", "notes", 350);
    mocks.listeners[0].next(snapshot([], false));

    await expect(pending).resolves.toEqual([]);
  });

  it("reuses the listener and its rows for the next read", async () => {
    const first = liveRows("owner-d", "folders", 350);
    mocks.listeners[0].next(snapshot([{ id: "f1", name: "Beta Folder" }], true));
    await first;

    await expect(liveRows("owner-d", "folders", 350)).resolves.toEqual([{ id: "f1", name: "Beta Folder" }]);
    expect(mocks.listeners).toHaveLength(1);
  });

  it("keeps the original blocking behaviour for default reads", async () => {
    const pending = liveRows("owner-e", "tasks");
    mocks.listeners[0].next(snapshot([{ id: "t1" }], false));

    await expect(pending).resolves.toEqual([{ id: "t1" }]);
  });
});
