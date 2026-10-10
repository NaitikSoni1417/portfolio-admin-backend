import { test, describe } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import express from "express";
import jwt from "jsonwebtoken";

import { auth } from "../src/middleware/auth.js";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";
import {
  parseAnomalyFilters,
  ANOMALY_SEVERITIES,
  ANOMALY_TYPES,
  ANOMALY_PAGE_SIZES,
} from "../src/visitorQuery.js";

const SECRET = "test-secret-for-anomalies-suite";
process.env.JWT_SECRET = SECRET;

/** Pinned 7-day window: hourly spike detection needs ≥ 6 hourly buckets. */
const WINDOW = "from=2026-01-14&to=2026-01-20";

function token() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "1h" });
}

/**
 * Deterministic seed that trips every detection rule exactly once (twice for
 * failed_logins, at two severities) so filters, summary and pagination can be
 * asserted against known counts:
 *
 *   1. traffic_spike       high   — 40 views in one hour (Jan 19 10:xx) vs ~0 baseline
 *   2. high_volume_endpoint low   — same IP, 40 views (below the 100 cut)
 *   3. failed_logins       medium — 3 attempts from 203.0.113.50
 *   4. failed_logins       high   — 5 attempts from 203.0.113.51
 *   5. firewall_block      high   — 1 SOC firewall trip from 192.0.2.99
 *
 * Summary must be high=3, medium=1, low=1.
 *
 * The spike hour sits on Jan 19 (not Jan 20) because zeroFillSeries truncates
 * the `to` boundary to the start of that UTC day — an hour bucket on the end
 * day itself would fall outside the filled series.
 */
function buildSignalSeed() {
  const visitors = [];
  for (let i = 0; i < 40; i += 1) {
    visitors.push({
      _id: `spike_${String(i).padStart(3, "0")}`,
      ip: "198.51.100.1",
      // No visitorId: repeatIps groups by identity (visitorId first, then ip),
      // so omitting it keeps the detection keyed on the network endpoint.
      sessionId: "sid-spike",
      page: "/",
      createdAt: new Date(`2026-01-19T10:${String(i % 60).padStart(2, "0")}:00.000Z`),
    });
  }

  const securityLogs = [];
  for (let i = 0; i < 3; i += 1) {
    securityLogs.push({
      _id: `fail_a_${i}`,
      action: "FAILED_LOGIN",
      ip: "203.0.113.50",
      reason: "Invalid credentials",
      createdAt: new Date(`2026-01-19T0${i + 1}:00:00.000Z`),
    });
  }
  for (let i = 0; i < 5; i += 1) {
    securityLogs.push({
      _id: `fail_b_${i}`,
      action: "FAILED_LOGIN",
      ip: "203.0.113.51",
      reason: "Invalid credentials",
      createdAt: new Date(`2026-01-18T0${i + 1}:00:00.000Z`),
    });
  }
  securityLogs.push({
    _id: "fw_1",
    action: "AUTO_BLOCKED_TRAFFIC",
    ip: "192.0.2.99",
    attempts: 42,
    reason: "Request volume exceeded the firewall threshold",
    createdAt: new Date("2026-01-17T06:00:00.000Z"),
  });

  return { visitors, securityLogs };
}

/** Quiet data: no rule's threshold is met, so the endpoint must report zero. */
function buildQuietSeed() {
  const visitors = Array.from({ length: 5 }, (_, i) => ({
    _id: `quiet_${i}`,
    ip: `198.51.100.${i + 10}`,
    visitorId: `uid-quiet-${i}`,
    sessionId: `sid-quiet-${i}`,
    page: "/",
    createdAt: new Date(`2026-01-1${i + 1}T08:00:00.000Z`),
  }));
  // A single failed login is below the "repeated" bar — must not alert.
  const securityLogs = [
    {
      _id: "fail_once",
      action: "FAILED_LOGIN",
      ip: "203.0.113.60",
      reason: "Invalid credentials",
      createdAt: new Date("2026-01-15T09:00:00.000Z"),
    },
  ];
  return { visitors, securityLogs };
}

/**
 * 12 firewall trips (each log = one detection) so limit=10 yields a real
 * second page — the ladder's smallest size is 10, so the 5-item signal seed
 * can never paginate.
 */
function buildBulkSeed() {
  const securityLogs = Array.from({ length: 12 }, (_, i) => ({
    _id: `fw_${i}`,
    action: "AUTO_BLOCKED_TRAFFIC",
    ip: `192.0.2.${i + 1}`,
    attempts: 30 + i,
    reason: "Request volume exceeded the firewall threshold",
    createdAt: new Date(Date.UTC(2026, 0, 15, i % 24, i % 60, 0)),
  }));
  return { visitors: [], securityLogs };
}

function makeApp(seed) {
  const repo = createMemoryRepo(seed);
  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo }));
  return { repo, app };
}

async function withServer(seed, fn) {
  const { app } = makeApp(seed);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const get = async (path, { auth: useToken = true } = {}) =>
    fetch(`${baseUrl}${path}`, {
      headers: useToken
        ? { Authorization: `Bearer ${token()}` }
        : { "Content-Type": "application/json" },
    });
  try {
    await fn({ baseUrl, get });
  } finally {
    server.close();
  }
}

// ── parseAnomalyFilters (pure) ───────────────────────────────────────────────

test("parseAnomalyFilters accepts empty, 'all' and valid values", () => {
  assert.deepEqual(parseAnomalyFilters({}), { ok: true, errors: [], severity: "", type: "" });
  assert.deepEqual(parseAnomalyFilters({ severity: "all", type: "ALL" }), {
    ok: true,
    errors: [],
    severity: "",
    type: "",
  });
  assert.deepEqual(parseAnomalyFilters({ severity: "HIGH", type: "Failed_Logins" }), {
    ok: true,
    errors: [],
    severity: "high",
    type: "failed_logins",
  });
});

test("parseAnomalyFilters rejects values outside the whitelist", () => {
  const badSeverity = parseAnomalyFilters({ severity: "critical" });
  assert.equal(badSeverity.ok, false);
  assert.match(badSeverity.errors[0], /severity/);

  const badType = parseAnomalyFilters({ type: "ddos" });
  assert.equal(badType.ok, false);
  assert.match(badType.errors[0], /type/);
});

test("whitelist constants match what the detector emits", () => {
  assert.deepEqual(ANOMALY_SEVERITIES, ["high", "medium", "low"]);
  assert.deepEqual(ANOMALY_TYPES, [
    "traffic_spike",
    "high_volume_endpoint",
    "failed_logins",
    "firewall_block",
  ]);
  assert.deepEqual(ANOMALY_PAGE_SIZES, [10, 25, 50]);
});

// ── GET /api/admin/visitors/anomalies ────────────────────────────────────────

describe("GET /api/admin/visitors/anomalies", () => {
  test("rejects requests without a token", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const res = await get(`/api/admin/visitors/anomalies?${WINDOW}`, { auth: false });
      assert.equal(res.status, 401);
    });
  });

  test("detects each rule once with evidence, sorted high→low", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const res = await get(`/api/admin/visitors/anomalies?${WINDOW}`);
      assert.equal(res.status, 200);
      const body = await res.json();

      assert.equal(body.ok, true);
      assert.equal(body.total, 5, "four rule types, failed_logins twice");
      assert.equal(body.page, 1);
      assert.equal(body.totalPages, 1);

      const types = body.items.map((i) => i.type).sort();
      assert.deepEqual(types, [
        "failed_logins",
        "failed_logins",
        "firewall_block",
        "high_volume_endpoint",
        "traffic_spike",
      ]);

      // Sort: all high before medium before low.
      const severities = body.items.map((i) => i.severity);
      assert.deepEqual(severities, ["high", "high", "high", "medium", "low"]);

      // Every item carries the honest disclaimer and a non-empty summary.
      for (const item of body.items) {
        assert.ok(item.disclaimer.length > 20, "disclaimer explains it is a pattern, not a verdict");
        assert.ok(item.summary.length > 10);
        assert.ok(item.evidence && typeof item.evidence === "object");
        assert.ok(["open", "in_review", "resolved", "false_positive"].includes(item.status));
      }

      const spike = body.items.find((i) => i.type === "traffic_spike");
      assert.equal(spike.evidence.pageViews, 40);
      assert.ok(spike.evidence.multiplier >= 2, "spike must clear the 2× baseline rule");
      assert.ok(spike.evidence.threshold >= 10);

      const endpoint = body.items.find((i) => i.type === "high_volume_endpoint");
      assert.equal(endpoint.evidence.ip, "198.51.100.1");
      assert.equal(endpoint.evidence.pageViews, 40);
      assert.equal(endpoint.severity, "low", "40 views is below the 100-view medium cut");

      const failed = body.items.filter((i) => i.type === "failed_logins");
      const byIp = Object.fromEntries(failed.map((i) => [i.evidence.ip, i]));
      assert.equal(byIp["203.0.113.50"].evidence.attempts, 3);
      assert.equal(byIp["203.0.113.50"].severity, "medium");
      assert.equal(byIp["203.0.113.51"].evidence.attempts, 5);
      assert.equal(byIp["203.0.113.51"].severity, "high");

      const firewall = body.items.find((i) => i.type === "firewall_block");
      assert.equal(firewall.evidence.ip, "192.0.2.99");
      assert.equal(firewall.severity, "high");
    });
  });

  test("summary counts every severity and type in the window", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}`)).json();
      assert.equal(body.summary.high, 3);
      assert.equal(body.summary.medium, 1);
      assert.equal(body.summary.low, 1);
      assert.deepEqual(body.summary.byType, {
        traffic_spike: 1,
        high_volume_endpoint: 1,
        failed_logins: 2,
        firewall_block: 1,
      });
    });
  });

  test("severity filter narrows items but not the summary", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&severity=high`)).json();
      assert.equal(body.total, 3);
      assert.ok(body.items.every((i) => i.severity === "high"));
      assert.equal(body.summary.high + body.summary.medium + body.summary.low, 5,
        "summary still describes the whole window");
    });
  });

  test("type filter narrows to one detection family", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&type=failed_logins`)).json();
      assert.equal(body.total, 2);
      assert.ok(body.items.every((i) => i.type === "failed_logins"));
    });
  });

  test("severity and type compose; an impossible pair returns zero, not an error", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const res = await get(`/api/admin/visitors/anomalies?${WINDOW}&severity=low&type=firewall_block`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
      assert.equal(body.totalPages, 1);
    });
  });

  test("invalid severity or type is a 400, never a silent pass-through", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const badSeverity = await get(`/api/admin/visitors/anomalies?${WINDOW}&severity=critical`);
      assert.equal(badSeverity.status, 400);
      assert.match((await badSeverity.json()).errors[0], /severity/);

      const badType = await get(`/api/admin/visitors/anomalies?${WINDOW}&type=ddos`);
      assert.equal(badType.status, 400);
      assert.match((await badType.json()).errors[0], /type/);
    });
  });

  test("paginates with the anomaly page-size ladder", async () => {
    await withServer(buildBulkSeed(), async ({ get }) => {
      const page1 = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&limit=10&page=1`)).json();
      assert.equal(page1.items.length, 10);
      assert.equal(page1.total, 12);
      assert.equal(page1.totalPages, 2);
      assert.equal(page1.limit, 10);
      assert.deepEqual(page1.pageSizes, [10, 25, 50]);

      const page2 = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&limit=10&page=2`)).json();
      assert.equal(page2.items.length, 2, "12 items over limit 10 → last page holds 2");
      assert.equal(page2.page, 2);

      // A page past the end clamps to the last page instead of lying with [].
      const past = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&limit=10&page=99`)).json();
      assert.equal(past.page, 2);
      assert.equal(past.items.length, 2);

      // Pages never overlap and their union is the full set.
      const keys = [...page1.items, ...page2.items].map((i) => i.key);
      assert.equal(new Set(keys).size, 12, "no duplicate detections across pages");
    });
  });

  test("rejects page sizes outside the anomaly ladder", async () => {
    await withServer(buildSignalSeed(), async ({ get }) => {
      const res = await get(`/api/admin/visitors/anomalies?${WINDOW}&limit=100`);
      assert.equal(res.status, 400);
      assert.match((await res.json()).errors[0], /limit/);
    });
  });

  test("quiet data reports zero detections, not fabricated ones", async () => {
    await withServer(buildQuietSeed(), async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}`)).json();
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
      assert.deepEqual(body.summary, {
        high: 0,
        medium: 0,
        low: 0,
        byType: {},
      });
      assert.ok(body.disclaimer.length > 0, "disclaimer is present even with nothing to show");
    });
  });

  test("a persisted review decorates the matching detection", async () => {
    const seed = buildSignalSeed();
    seed.reviews = [
      {
        key: "firewall_block:192.0.2.99:2026-01-17T06:00:00.000Z",
        status: "resolved",
        notes: "Confirmed office VPN burst.",
        updatedAt: new Date("2026-01-18T10:00:00.000Z"),
      },
    ];
    await withServer(seed, async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}&type=firewall_block`)).json();
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0].status, "resolved");
      assert.equal(body.items[0].notes, "Confirmed office VPN burst.");
    });
  });

  test("empty dataset returns an honest zero with range metadata", async () => {
    await withServer({ visitors: [], securityLogs: [] }, async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/anomalies?${WINDOW}`)).json();
      assert.equal(body.ok, true);
      assert.equal(body.total, 0);
      assert.deepEqual(body.items, []);
      assert.equal(body.range.preset, "custom");
      assert.equal(body.range.timezone, "UTC");
      assert.equal(body.thresholds.repeatIpMinPageViews, 40);
      assert.ok(body.thresholds.spikeRule.includes("3σ"));
    });
  });
});
