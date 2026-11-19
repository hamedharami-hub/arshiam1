import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGrant, grantAllows, testStore, type AssistantGrant } from "./_lib/assistantAccess";
import { handleAgentRequest, resetIdempotencyCache } from "./_lib/agentApi";
import { resetRateLimits } from "./_lib/rateLimiter";

function createMockReqRes(options: {
  method?: string;
  url: string;
  token?: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, any>;
}) {
  const req: any = {
    method: options.method || "GET",
    url: options.url,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    query: options.query || {},
    body: options.body || null,
  };

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = JSON.stringify(data);
      return this;
    },
    end(data?: any) {
      if (data) this.body = typeof data === "string" ? data : JSON.stringify(data);
    },
  };

  return { req, res };
}

const expires = () => new Date(Date.now() + 86400000).toISOString();

async function call(token: string, method: string, url: string, body?: any, headers?: Record<string, string>) {
  const query = Object.fromEntries(new URL(url, "http://localhost").searchParams.entries());
  const { req, res } = createMockReqRes({ method, url, token, body, headers, query });
  await handleAgentRequest(req, res);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

async function grantWith(scopes: AssistantGrant["scopes"]) {
  return (await createGrant("owner", "Test agent", scopes, expires())).secret;
}

describe("Agent API: habits, daily check-ins and mind goals/values", () => {
  beforeEach(() => {
    testStore.enabled = true;
    testStore.reset();
    resetRateLimits();
    resetIdempotencyCache();
  });

  afterEach(() => {
    testStore.reset();
    testStore.enabled = false;
  });

  it("creates, reads, lists, updates and deletes a habit without exposing user_id", async () => {
    const token = await grantWith(["habits:write"]);

    const created = await call(token, "POST", "/api/v1/agent/habits", {
      title: "  Drink water  ",
      frequency: "daily",
      color: "#22c55e",
      streak: 3,
      completed_dates: ["2026-01-04", "2026-01-05"],
    });
    expect(created.status).toBe(201);
    const habit = created.body.data;
    expect(habit).toMatchObject({
      title: "Drink water",
      frequency: "daily",
      color: "#22c55e",
      streak: 3,
      completed_dates: ["2026-01-04", "2026-01-05"],
    });
    expect(habit.id).toBeTruthy();
    expect(habit).not.toHaveProperty("user_id");
    // The app reads `completedDates`, so the stored document must use that key.
    expect((testStore.habits.get(habit.id) as any).completedDates).toEqual(["2026-01-04", "2026-01-05"]);
    expect(typeof habit.created_at).toBe("string");
    expect(typeof habit.updated_at).toBe("string");

    const list = await call(token, "GET", "/api/v1/agent/habits?page=1&page_size=10");
    expect(list.status).toBe(200);
    expect(list.body.pagination).toMatchObject({ page: 1, page_size: 10, total: 1 });
    expect(list.body.data[0].id).toBe(habit.id);

    const single = await call(token, "GET", `/api/v1/agent/habits/${habit.id}`);
    expect(single.status).toBe(200);
    expect(single.body.data.title).toBe("Drink water");

    const patched = await call(token, "PATCH", `/api/v1/agent/habits/${habit.id}`, { title: "Drink 2L water", streak: 4 });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ title: "Drink 2L water", streak: 4, color: "#22c55e" });

    const deleted = await call(token, "DELETE", `/api/v1/agent/habits/${habit.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: habit.id, deleted: true });
    expect(testStore.habits.size).toBe(0);

    const missing = await call(token, "GET", `/api/v1/agent/habits/${habit.id}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects invalid habit fields and unsupported methods", async () => {
    const token = await grantWith(["habits:write"]);

    for (const body of [
      {},
      { title: "" },
      { title: "x".repeat(501) },
      { title: "Habit", streak: 10001 },
      { title: "Habit", frequency: "x".repeat(51) },
      { title: "Habit", completed_dates: ["2026-02-30"] },
      { title: "Habit", completed_dates: Array.from({ length: 401 }, () => "2026-01-01") },
    ]) {
      const response = await call(token, "POST", "/api/v1/agent/habits", body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(testStore.habits.size).toBe(0);

    const method = await call(token, "PUT", "/api/v1/agent/habits");
    expect(method.status).toBe(405);
    expect(method.body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("returns 403 for every new endpoint without its scope, while write implies read", async () => {
    const token = await grantWith(["tasks:read"]);
    for (const [method, url] of [
      ["GET", "/api/v1/agent/habits"],
      ["POST", "/api/v1/agent/habits"],
      ["GET", "/api/v1/agent/checkins"],
      ["GET", "/api/v1/agent/checkins/2026-01-05"],
      ["PUT", "/api/v1/agent/checkins/2026-01-05"],
      ["GET", "/api/v1/agent/mind/goals"],
      ["POST", "/api/v1/agent/mind/goals"],
      ["GET", "/api/v1/agent/mind/values"],
      ["PATCH", "/api/v1/agent/mind/values"],
    ] as const) {
      const response = await call(token, method, url, method === "GET" ? undefined : { title: "x", domain: "family", text: "x", values: { health: {} } });
      expect(response.status, `${method} ${url}`).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }

    const base = {
      id: "g", userId: "owner", name: "n", createdAt: new Date().toISOString(), expiresAt: expires(), revokedAt: null,
    } as AssistantGrant;
    for (const [write, read] of [["habits:write", "habits:read"], ["checkins:write", "checkins:read"], ["mind:write", "mind:read"]] as const) {
      const grant = { ...base, scopes: [write] } as AssistantGrant;
      expect(grantAllows("owner", grant, read)).toBe(true);
    }
  });

  it("makes habit creation idempotent for a repeated key and conflicts on different input", async () => {
    const token = await grantWith(["habits:write"]);
    const headers = { "idempotency-key": "habit-retry-1" };
    const body = { title: "Meditate", streak: 1 };

    const first = await call(token, "POST", "/api/v1/agent/habits", body, headers);
    expect(first.status).toBe(201);
    const retry = await call(token, "POST", "/api/v1/agent/habits", body, headers);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(testStore.habits.size).toBe(1);

    const conflict = await call(token, "POST", "/api/v1/agent/habits", { title: "Different habit" }, headers);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(testStore.habits.size).toBe(1);
    expect(testStore.audit.filter((row) => row.action === "habits:create")).toHaveLength(1);
  });

  it("keeps one check-in document per day and enforces updated_at revisions", async () => {
    const token = await grantWith(["checkins:write"]);

    const first = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-05", { mood: 8, notes: "private checkin text" });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ id: "2026-01-05", checkin_date: "2026-01-05", mood: 8, notes: "private checkin text" });
    expect(first.body.data).not.toHaveProperty("user_id");
    const createdAt = first.body.data.created_at;

    const second = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-05", { energy: 6, sleep_hours: 7.5 });
    expect(second.status).toBe(200);
    expect(testStore.checkins.size).toBe(1);
    expect(second.body.data).toMatchObject({ mood: 8, energy: 6, sleep_hours: 7.5, notes: "private checkin text", created_at: createdAt });
    expect(second.body.data.id).toBe("2026-01-05");

    const accepted = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-05", {
      focus: 7,
      expected_revision: second.body.data.updated_at,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.focus).toBe(7);
    expect(testStore.checkins.size).toBe(1);

    const stale = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-05", { focus: 2, expected_revision: "stale-revision" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("REVISION_CONFLICT");
    expect(testStore.checkins.get("2026-01-05").focus).toBe(7);

    const range = await call(token, "GET", "/api/v1/agent/checkins?from=2026-01-01&to=2026-01-31");
    expect(range.status).toBe(200);
    expect(range.body.pagination.total).toBe(1);

    const outside = await call(token, "GET", "/api/v1/agent/checkins?from=2026-02-01&to=2026-02-28");
    expect(outside.body.pagination.total).toBe(0);

    const reversedRange = await call(token, "GET", "/api/v1/agent/checkins?from=2026-02-01&to=2026-01-01");
    expect(reversedRange.status).toBe(400);

    const missing = await call(token, "GET", "/api/v1/agent/checkins/2026-01-06");
    expect(missing.status).toBe(404);
    const invalidDate = await call(token, "GET", "/api/v1/agent/checkins/2026-13-01");
    expect(invalidDate.status).toBe(400);

    const auditRows = testStore.audit.filter((row) => row.action === "checkins:save");
    expect(auditRows).toHaveLength(3);
    expect(auditRows.every((row) => row.entityId === "2026-01-05")).toBe(true);
    expect(JSON.stringify(testStore.audit)).not.toContain("private checkin text");
  });

  it("validates check-in scores and notes bounds", async () => {
    const token = await grantWith(["checkins:write"]);
    for (const body of [
      { mood: 0 },
      { mood: 11 },
      { energy: 5.5 },
      { sleep_hours: 25 },
      { sleep_hours: -1 },
      { notes: "x".repeat(2001) },
      { focus: "high" },
    ]) {
      const response = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-07", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(testStore.checkins.size).toBe(0);

    const empty = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-07", {});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(testStore.checkins.size).toBe(0);

    const cleared = await call(token, "PUT", "/api/v1/agent/checkins/2026-01-07", { mood: null, sleep_hours: null });
    expect(cleared.status).toBe(201);
    expect(cleared.body.data).toMatchObject({ mood: null, sleep_hours: null });
  });

  it("merges only submitted value domains and keeps the rest untouched", async () => {
    const token = await grantWith(["mind:write"]);

    const first = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: {
        health: { importance: 8, consistency: 6, value: "Exercise", constraints: "Evenings" },
        family: { importance: 9, value: "Call weekly" },
      },
    });
    expect(first.status).toBe(200);
    expect(first.body.data.values.family).toEqual({ importance: 9, value: "Call weekly" });

    const second = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: { career: { importance: 5 } },
    });
    expect(second.status).toBe(200);
    expect(second.body.data.values.career).toEqual({ importance: 5 });
    expect(second.body.data.values.health).toEqual({ importance: 8, consistency: 6, value: "Exercise", constraints: "Evenings" });
    expect(second.body.data.values.family).toEqual({ importance: 9, value: "Call weekly" });

    const partial = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: { family: { consistency: 4 } },
    });
    expect(partial.status).toBe(200);
    expect(partial.body.data.values.family).toEqual({ importance: 9, value: "Call weekly", consistency: 4 });
    expect(partial.body.data.values.health.value).toBe("Exercise");

    const read = await call(token, "GET", "/api/v1/agent/mind/values");
    expect(read.status).toBe(200);
    expect(read.body.data.values).toEqual(partial.body.data.values);
    expect(read.body.data.updated_at).toBe(partial.body.data.updated_at);

    const stale = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: { health: { importance: 1 } },
      expected_revision: "stale-revision",
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("REVISION_CONFLICT");

    const accepted = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: { health: { importance: 7 } },
      expected_revision: read.body.data.updated_at,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.values.health).toEqual({ importance: 7, consistency: 6, value: "Exercise", constraints: "Evenings" });

    // The app's sliders start at 0, so 0 is a valid score.
    const zero = await call(token, "PATCH", "/api/v1/agent/mind/values", {
      values: { health: { consistency: 0 } },
      expected_revision: accepted.body.data.updated_at,
    });
    expect(zero.status).toBe(200);
    expect(zero.body.data.values.health.consistency).toBe(0);

    for (const body of [
      { values: { unknown: { importance: 5 } } },
      { values: { health: { importance: 11 } } },
      { values: { health: { value: "x".repeat(2001) } } },
      { values: { health: { unexpected: true } } },
      { values: {} },
      { values: [] },
    ]) {
      const response = await call(token, "PATCH", "/api/v1/agent/mind/values", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(testStore.audit.filter((row) => row.action === "mind_values:update")).toHaveLength(5);
    expect(JSON.stringify(testStore.audit)).not.toContain("Exercise");
    expect(JSON.stringify(testStore.audit)).not.toContain("Call weekly");
  });

  it("stores a goal horizon only when supplied and rejects invalid domains/horizons", async () => {
    const token = await grantWith(["mind:write"]);

    const withoutHorizon = await call(token, "POST", "/api/v1/agent/mind/goals", { domain: "family", text: "Call mom" });
    expect(withoutHorizon.status).toBe(201);
    expect(withoutHorizon.body.data).toMatchObject({ domain: "family", text: "Call mom" });
    expect(withoutHorizon.body.data).not.toHaveProperty("horizon");
    expect(testStore.mindGoals.get(withoutHorizon.body.data.id)).not.toHaveProperty("horizon");

    const withHorizon = await call(token, "POST", "/api/v1/agent/mind/goals", { domain: "health", text: "Run 5k", horizon: "week" });
    expect(withHorizon.status).toBe(201);
    expect(withHorizon.body.data.horizon).toBe("week");

    for (const body of [
      { domain: "nope", text: "Invalid domain" },
      { domain: "family" },
      { domain: "family", text: "" },
      { domain: "family", text: "x".repeat(2001) },
      { domain: "family", text: "Goal", horizon: "decade" },
    ]) {
      const response = await call(token, "POST", "/api/v1/agent/mind/goals", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    const badFilter = await call(token, "GET", "/api/v1/agent/mind/goals?domain=unknown");
    expect(badFilter.status).toBe(400);

    const familyOnly = await call(token, "GET", "/api/v1/agent/mind/goals?domain=family");
    expect(familyOnly.body.pagination.total).toBe(1);
    expect(familyOnly.body.data[0].id).toBe(withoutHorizon.body.data.id);

    const weekOnly = await call(token, "GET", "/api/v1/agent/mind/goals?horizon=week");
    expect(weekOnly.body.pagination.total).toBe(1);

    const stale = await call(token, "PATCH", `/api/v1/agent/mind/goals/${withHorizon.body.data.id}`, {
      text: "Run 10k",
      expected_revision: "stale-revision",
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("REVISION_CONFLICT");

    const patched = await call(token, "PATCH", `/api/v1/agent/mind/goals/${withHorizon.body.data.id}`, {
      text: "Run 10k",
      expected_revision: withHorizon.body.data.updated_at,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ text: "Run 10k", horizon: "week", domain: "health" });

    const deleted = await call(token, "DELETE", `/api/v1/agent/mind/goals/${withHorizon.body.data.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: withHorizon.body.data.id, deleted: true });

    const missing = await call(token, "DELETE", `/api/v1/agent/mind/goals/${withHorizon.body.data.id}`);
    expect(missing.status).toBe(404);

    expect(testStore.audit.filter((row) => row.action === "mind_goal:create")).toHaveLength(2);
    expect(testStore.audit.filter((row) => row.action === "mind_goal:update")).toHaveLength(1);
    expect(testStore.audit.filter((row) => row.action === "mind_goal:delete")).toHaveLength(1);
    expect(JSON.stringify(testStore.audit)).not.toContain("Call mom");
    expect(JSON.stringify(testStore.audit)).not.toContain("Run 10k");
  });

  it("makes mind goal creation idempotent", async () => {
    const token = await grantWith(["mind:write"]);
    const headers = { "idempotency-key": "goal-retry-1" };
    const body = { domain: "self", text: "Journal daily" };

    const first = await call(token, "POST", "/api/v1/agent/mind/goals", body, headers);
    expect(first.status).toBe(201);
    const retry = await call(token, "POST", "/api/v1/agent/mind/goals", body, headers);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(testStore.mindGoals.size).toBe(1);

    const conflict = await call(token, "POST", "/api/v1/agent/mind/goals", { ...body, text: "Different goal" }, headers);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(testStore.audit.filter((row) => row.action === "mind_goal:create")).toHaveLength(1);
  });
});
