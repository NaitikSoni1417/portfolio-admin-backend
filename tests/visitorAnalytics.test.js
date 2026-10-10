import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

import { auth } from "../src/middleware/auth.js";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";

const SECRET = "test-secret-for-analytics-suite";
process.env.JWT_SECRET = SECRET;

const HOUR = 3600000;
const DAY = 86400000;
const NOW = Date.parse("2026-01-20T12:00:00.000Z");

/** Deterministic 30-day window over the pinned seed. */
const WINDOW = "startDate=2025-12-22&endDate=2026-01-20";
const SHORT_WINDOW = "startDate=2026-01-18&endDate=2026-01-20";

const COUNTRIES = [
  "India",
  "United States",
  "Germany",
  "Japan",
  "Brazil",
  "France",
  "Canada",
  "Spain",
  "Italy",
  "Australia",
];
const DEVICES = ["Desktop", "Mobile", "Tablet"];
const BROWSERS = ["Chrome 154", "Firefox 156", "Safari 18"];

/** 62 clean records + 2 with missing/malformed dimensions, all inside 30 days. */
function buildSeed() {
  const visitors = Array.from({ length: 62 }, (_, index) => {
    const i = index + 1;
    // 40 single-visit identities, 20 of which then repeat once → a real
    // new/returning split instead of a degenerate all-returning set.
    const visitorId = `uid-${i <= 40 ? i : i - 40}`;
    return {
      _id: `visitor_${String(i).padStart(3, "0")}`,
      ip: `203.0.113.${i}`,
      visitorId,
      sessionId: `sid-${i % 11}`,
      page: ["/", "/admin", "/projects"][i % 3],
      country: COUNTRIES[i % COUNTRIES.length],
      device: DEVICES[i % DEVICES.length],
      browser: BROWSERS[i % BROWSERS.length],
      os: "macOS 15.4",
      referrer: i % 4 === 0 ? "" : "https://www.google.com/",
      isp: "GTPL Networks",
      createdAt: new Date(NOW - (i % 10) * DAY - (i % 24) * HOUR),
    };
  });

  // Missing / malformed values must surface as "Unknown", never vanish.
  visitors.push({
    _id: "visitor_063",
    ip: "203.0.113.63",
    visitorId: "uid-unknown",
    sessionId: "sid-unknown",
    page: "/",
    country: null,
    device: "",
    createdAt: new Date(NOW - 1 * DAY),
  });
  visitors.push({
    _id: "visitor_064",
    ip: "203.0.113.64",
    visitorId: "uid-unknown-2",
    sessionId: "sid-unknown",
    page: "/",
    device: "Smart TV",
    createdAt: new Date(NOW - 2 * DAY),
  });

  return { visitors };
}

function token() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "1h" });
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

describe("GET /api/admin/visitors/analytics", () => {
  let server;
  let baseUrl;

  before(async () => {
    const { app } = makeApp(buildSeed());
    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server?.close());

  const api = (path, { auth: useToken = true } = {}) =>
    fetch(`${baseUrl}${path}`, {
      headers: useToken
        ? { Authorization: `Bearer ${token()}` }
        : { "Content-Type": "application/json" },
    });

  // ── Authentication ─────────────────────────────────────────────────────────

  test("rejects requests without a token", async () => {
    const res = await api("/api/admin/visitors/analytics", { auth: false });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "No token");
  });

  // ── Shape ──────────────────────────────────────────────────────────────────

  test("returns totals, series, hourly breakdown and range metadata", async () => {
    const res = await api(`/api/admin/visitors/analytics?${WINDOW}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.ok, true);
    assert.equal(body.range.from, "2025-12-22");
    assert.equal(body.range.to, "2026-01-20");
    assert.equal(body.range.preset, "custom");
    assert.equal(body.range.timezone, "UTC");
    assert.equal(body.range.granularity, "day");
    assert.equal(body.range.days, 30);

    for (const key of ["pageViews", "sessions", "uniqueIps", "newIps", "returningIps", "countries"]) {
      assert.ok(Number.isFinite(body.totals[key]), `totals.${key} should be a number`);
    }
    assert.ok(Array.isArray(body.series));
    assert.equal(body.series.length, 30, "one zero-filled bucket per day");
    assert.equal(body.series[0].key, "2025-12-22");
    assert.equal(body.series.at(-1).key, "2026-01-20");

    assert.ok(Array.isArray(body.hourly));
    assert.equal(body.hourly.length, 24);
    assert.deepEqual(
      body.hourly.map((h) => h.hour),
      [...Array(24).keys()]
    );

    assert.ok(body.range.label.includes("2026"));
    assert.ok(body.meta.generatedAt);
    assert.equal(typeof body.meta.definitions.uniqueIps, "string");
  });

  test("a named preset resolves to a rolling window ending today", async () => {
    const body = await (await api("/api/admin/visitors/analytics?preset=30d")).json();
    const todayUtc = new Date().toISOString().slice(0, 10);
    assert.equal(body.range.preset, "30d");
    assert.equal(body.range.to, todayUtc);
    assert.equal(body.range.days, 30);
    assert.equal(body.range.from, new Date(Date.parse(todayUtc) - 29 * DAY).toISOString().slice(0, 10));
  });

  test("new and returning visitors partition the unique identities exactly", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    assert.equal(body.totals.newIps + body.totals.returningIps, body.totals.uniqueIps);
    assert.ok(body.totals.returningIps > 0, "seed contains repeat identities");
    assert.ok(body.totals.newIps > 0, "seed contains single-visit identities");
  });

  // ── Aggregation is over the whole collection, not a page ───────────────────

  test("counts every in-range record, not the first page of rows", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    assert.equal(body.totals.pageViews, 64, "all 64 seeded records are in range");
    assert.ok(body.totals.pageViews > 50, "proves the response is not capped at a page size");
  });

  test("series page views sum back to the headline total", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    const summed = body.series.reduce((sum, row) => sum + row.pageViews, 0);
    assert.equal(summed, body.totals.pageViews);
  });

  test("hourly buckets sum back to the headline total", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    const summed = body.hourly.reduce((sum, row) => sum + row.pageViews, 0);
    assert.equal(summed, body.totals.pageViews);
  });

  // ── Date filtering ─────────────────────────────────────────────────────────

  test("excludes records outside the selected range", async () => {
    const wide = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    const narrow = await (await api(`/api/admin/visitors/analytics?${SHORT_WINDOW}`)).json();
    assert.ok(wide.totals.pageViews > narrow.totals.pageViews, "narrower range holds fewer visits");
    assert.ok(narrow.totals.pageViews > 0);
    assert.equal(narrow.range.days, 3);
  });

  test("honours an explicit startDate / endDate window", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${SHORT_WINDOW}`)).json();
    assert.equal(body.range.from, "2026-01-18");
    assert.equal(body.range.to, "2026-01-20");
    assert.equal(body.range.days, 3);
    assert.equal(body.range.granularity, "hour", "short ranges bucket by hour");
    assert.equal(body.range.preset, "custom");
    assert.ok(body.totals.pageViews > 0);
    assert.ok(body.totals.pageViews < 64);
  });

  // ── Granularity ────────────────────────────────────────────────────────────

  test("buckets long ranges by day and lets an explicit granularity win", async () => {
    const auto = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    assert.equal(auto.range.granularity, "day");
    assert.equal(auto.series.length, 30);

    const forced = await (await api(`/api/admin/visitors/analytics?${WINDOW}&granularity=hour`)).json();
    assert.equal(forced.range.granularity, "hour");
    assert.ok(forced.series.length > 24, "hourly buckets cover the whole month");
    assert.ok(forced.series[0].key.includes("T"), "hourly keys carry a time component");
    assert.ok(forced.series[0].key.endsWith(":00:00.000Z"));
    assert.equal(
      forced.series.reduce((sum, row) => sum + row.pageViews, 0),
      forced.totals.pageViews
    );
  });

  // ── Timezone ───────────────────────────────────────────────────────────────

  test("bucketing follows the requested timezone, not the server clock", async () => {
    // 20:00 UTC on Jan 20 is already 01:30 on Jan 21 in Asia/Kolkata (+05:30).
    await withServer(
      {
        visitors: [
          {
            _id: "v1",
            ip: "198.51.100.1",
            visitorId: "uid-tz",
            sessionId: "sid-tz",
            country: "India",
            createdAt: new Date(Date.parse("2026-01-20T20:00:00.000Z")),
          },
        ],
      },
      async ({ get }) => {
        const utc = await (
          await get("/api/admin/visitors/analytics?startDate=2026-01-16&endDate=2026-01-20")
        ).json();
        assert.equal(utc.range.timezone, "UTC");
        assert.equal(utc.range.granularity, "day");
        assert.equal(utc.totals.pageViews, 1);
        assert.equal(utc.series.find((row) => row.key === "2026-01-20").pageViews, 1);
        assert.equal(utc.series.find((row) => row.key === "2026-01-21"), undefined);
        assert.equal(utc.hourly[20].pageViews, 1, "record lands in UTC hour 20");
        assert.equal(utc.hourly[1].pageViews, 0);

        const ist = await (
          await get(
            "/api/admin/visitors/analytics?startDate=2026-01-17&endDate=2026-01-21&timezone=Asia/Kolkata"
          )
        ).json();
        assert.equal(ist.range.timezone, "Asia/Kolkata");
        assert.equal(ist.totals.pageViews, 1, "same record belongs to Jan 21 in IST");
        assert.equal(ist.series.find((row) => row.key === "2026-01-21").pageViews, 1);
        assert.equal(ist.series.find((row) => row.key === "2026-01-20").pageViews, 0);
        assert.equal(ist.hourly[1].pageViews, 1, "01:30 IST is local hour 1");
        assert.equal(ist.hourly[20].pageViews, 0);
      }
    );
  });

  // ── Breakdowns ─────────────────────────────────────────────────────────────

  test("country breakdown reports counts, shares and an Others rollup", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();

    assert.ok(body.countries.total >= 10, "seed spans at least ten countries");
    assert.ok(body.countries.items.length <= 8, "top countries only");
    assert.ok(body.countries.others, "the long tail is folded into Others");
    assert.ok(body.countries.others.count > 0);

    const summed = body.countries.items.reduce((s, r) => s + r.count, 0) + body.countries.others.count;
    assert.equal(summed, body.totals.pageViews, "countries cover every record exactly once");

    for (const row of body.countries.items) {
      const expected = Math.round((row.count / body.totals.pageViews) * 1000) / 10;
      assert.equal(row.share, expected, `share for ${row.key}`);
      assert.ok(row.share > 0 && row.share <= 100, `share out of range: ${row.share}`);
    }
  });

  test("device and browser breakdowns group missing values as Unknown", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();

    const deviceKeys = body.devices.map((d) => d.key);
    assert.ok(deviceKeys.includes("Unknown"), "empty device string becomes Unknown");
    assert.ok(deviceKeys.includes("Smart TV"));

    const countryKeys = body.countries.items
      .map((c) => c.key)
      .concat(body.countries.others ? ["Others"] : []);
    assert.ok(!countryKeys.includes("") && !countryKeys.includes("undefined"));
    assert.equal(
      body.countries.items.length + (body.countries.others ? 1 : 0),
      body.countries.items.length + (body.countries.others ? 1 : 0)
    );
    assert.ok(body.totals.countries >= 11, "the null country still counts as its own group");
    assert.equal(
      body.countries.items.reduce((s, r) => s + r.count, 0) + (body.countries.others?.count ?? 0),
      body.totals.pageViews
    );

    const deviceSum = body.devices.reduce((s, r) => s + r.count, 0);
    assert.equal(deviceSum, body.totals.pageViews);
  });

  test("surfaces an Unknown country group when it is one of the top values", async () => {
    await withServer(
      {
        visitors: [
          ...Array.from({ length: 5 }, (_, i) => ({
            _id: `in_${i}`,
            ip: `198.51.100.${i}`,
            visitorId: `in-${i}`,
            sessionId: `in-sid-${i}`,
            country: "India",
            createdAt: new Date(NOW - 1 * DAY),
          })),
          ...Array.from({ length: 3 }, (_, i) => ({
            _id: `missing_${i}`,
            ip: `192.0.2.${i}`,
            visitorId: `missing-${i}`,
            sessionId: `missing-sid-${i}`,
            country: null,
            createdAt: new Date(NOW - 1 * DAY),
          })),
        ],
      },
      async ({ get }) => {
        const body = await (await get(`/api/admin/visitors/analytics?${WINDOW}`)).json();
        assert.equal(body.totals.countries, 2);
        assert.deepEqual(
          body.countries.items.map((c) => [c.key, c.count]),
          [
            ["India", 5],
            ["Unknown", 3],
          ]
        );
        assert.equal(body.countries.items[1].share, 37.5);
      }
    );
  });

  test("applies country and device filters to the aggregation", async () => {
    const unfiltered = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    const filtered = await (
      await api(`/api/admin/visitors/analytics?${WINDOW}&country=India&device=Desktop`)
    ).json();

    assert.ok(filtered.totals.pageViews > 0);
    assert.ok(filtered.totals.pageViews < unfiltered.totals.pageViews);
    assert.deepEqual(filtered.devices.map((d) => d.key), ["Desktop"]);
    assert.deepEqual(filtered.countries.items.map((c) => c.key), ["India"]);
  });

  // ── Comparison window ──────────────────────────────────────────────────────

  test("compares the range against the equally long previous window", async () => {
    const body = await (await api(`/api/admin/visitors/analytics?${WINDOW}`)).json();
    assert.ok(body.previous, "previous window is present");
    assert.equal(body.previous.from, "2025-11-22");
    assert.equal(body.previous.to, "2025-12-21");
    assert.equal(body.previous.days, 30);
    assert.equal(body.previous.pageViews, 0, "the seed has no traffic before the range");

    // A zero denominator must not invent a percentage.
    assert.equal(body.deltas.pageViews, null);
    assert.equal(body.deltas.sessions, null);
    assert.equal(body.deltas.uniqueIps, null);
    assert.equal(body.meta.previousRange.from, "2025-11-22");
  });

  test("reports a real percentage when the previous window has traffic", async () => {
    await withServer(
      {
        visitors: [
          ...Array.from({ length: 10 }, (_, i) => ({
            _id: `old_${i}`,
            ip: `198.51.100.${i}`,
            visitorId: `old-uid-${i}`,
            sessionId: `old-sid-${i}`,
            // Jan 1 – Jan 10: exactly the previous window for the range below.
            createdAt: new Date(NOW - (10 + i) * DAY),
          })),
          ...Array.from({ length: 20 }, (_, i) => ({
            _id: `new_${i}`,
            ip: `192.0.2.${i}`,
            visitorId: `new-uid-${i}`,
            sessionId: `new-sid-${i}`,
            createdAt: new Date(NOW - (i % 10) * DAY),
          })),
        ],
      },
      async ({ get }) => {
        const body = await (
          await get("/api/admin/visitors/analytics?startDate=2026-01-11&endDate=2026-01-20")
        ).json();
        assert.equal(body.totals.pageViews, 20);
        assert.equal(body.previous.pageViews, 10);
        assert.equal(body.deltas.pageViews, 100, "20 is +100% over 10");
        assert.equal(body.deltas.sessions, 100);
        assert.equal(body.previous.from, "2026-01-01");
        assert.equal(body.previous.to, "2026-01-10");
      }
    );
  });

  // ── Privacy ────────────────────────────────────────────────────────────────

  test("never returns a raw IP address", async () => {
    const res = await api(`/api/admin/visitors/analytics?${WINDOW}`);
    const raw = await res.text();
    assert.ok(!raw.includes("203.0.113"), "response must not contain visitor IPs");

    const body = JSON.parse(raw);
    const walk = (value, path = "") => {
      if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          assert.notEqual(k.toLowerCase(), "ip", `unexpected "ip" field at ${path}.${k}`);
          walk(v, `${path}.${k}`);
        }
      }
    };
    walk(body);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  test("rejects malformed dates, inverted ranges and unknown presets", async () => {
    const cases = [
      ["startDate=not-a-date&endDate=2026-01-20", /startDate/],
      ["startDate=2026-01-20&endDate=2026-13-40", /endDate/],
      ["startDate=2026-01-20&endDate=2026-01-01", /earlier/],
      ["startDate=2026-01-20", /endDate is required/],
      ["endDate=2026-01-20", /startDate is required/],
      ["preset=forever", /preset must be one of/],
      ["preset=30d&startDate=2026-01-01&endDate=2026-01-20", /not both/],
    ];
    for (const [query, pattern] of cases) {
      const res = await api(`/api/admin/visitors/analytics?${query}`);
      assert.equal(res.status, 400, `${query} should be rejected`);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.ok(pattern.test(body.errors.join(" ")), `unexpected message for ${query}: ${body.errors}`);
    }
  });

  test("rejects a range longer than the aggregation cap", async () => {
    const res = await api("/api/admin/visitors/analytics?startDate=2020-01-01&endDate=2026-01-20");
    assert.equal(res.status, 400);
    assert.match((await res.json()).errors.join(" "), /maximum is 366/);
  });

  test("rejects an invalid timezone and an invalid granularity", async () => {
    const badTz = await api(`/api/admin/visitors/analytics?${WINDOW}&timezone=Mars/Olympus`);
    assert.equal(badTz.status, 400);
    assert.match((await badTz.json()).errors.join(" "), /IANA zone/);

    const badGranularity = await api(`/api/admin/visitors/analytics?${WINDOW}&granularity=minute`);
    assert.equal(badGranularity.status, 400);
    assert.match((await badGranularity.json()).errors.join(" "), /granularity must be day or hour/);
  });

  test("rejects duplicated query parameters", async () => {
    const res = await api("/api/admin/visitors/analytics?preset=30d&preset=7d");
    assert.equal(res.status, 400);
    assert.match((await res.json()).errors.join(" "), /duplicate query parameter/);
  });

  // ── Empty collection ───────────────────────────────────────────────────────

  test("returns an honest all-zero payload when nothing has been recorded", async () => {
    await withServer({ visitors: [] }, async ({ get }) => {
      const body = await (await get(`/api/admin/visitors/analytics?${WINDOW}`)).json();
      assert.equal(body.totals.pageViews, 0);
      assert.equal(body.totals.sessions, 0);
      assert.equal(body.totals.uniqueIps, 0);
      assert.equal(body.totals.countries, 0);
      assert.deepEqual(body.countries.items, []);
      assert.equal(body.countries.others, null);
      assert.deepEqual(body.devices, []);
      assert.equal(body.series.length, 30);
      assert.ok(body.series.every((row) => row.pageViews === 0), "gaps read as zero, not missing");
      assert.ok(body.hourly.every((row) => row.pageViews === 0), "every hour is zero on an empty range");
      assert.equal(body.previous.pageViews, 0);
    });
  });
});
