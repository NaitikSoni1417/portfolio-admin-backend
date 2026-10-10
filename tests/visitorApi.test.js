import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

import { auth } from "../src/middleware/auth.js";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";

const SECRET = "test-secret-for-visitor-api-suite";
process.env.JWT_SECRET = SECRET;

const HOUR = 3600000;
const NOW = Date.parse("2026-01-20T12:00:00.000Z");

const COUNTRIES = ["India", "United States", "Germany"];
const DEVICES = ["Desktop", "Mobile"];
const BROWSERS = ["Chrome 154", "Firefox 156", "Safari 18"];
const PAGES = ["/", "/admin", "/projects"];

function makeVisitor(i) {
  const country = COUNTRIES[i % COUNTRIES.length];
  return {
    _id: `visitor_${String(i).padStart(3, "0")}`,
    // Every 7th record reuses one endpoint so "returning visitor" enrichment
    // has real data to work with instead of 57 unique IPs.
    ip: i % 7 === 0 ? "198.51.100.10" : `10.0.${Math.floor(i / 250)}.${i % 250}`,
    visitorId: `uid-${i % 9}`,
    sessionId: `sid-${i % 5}`,
    page: PAGES[i % PAGES.length],
    country,
    countryCode: country === "India" ? "IN" : country === "Germany" ? "DE" : "US",
    city: country === "India" ? "Vadodara" : "Ashburn",
    region: country === "India" ? "Gujarat" : "Virginia",
    isp: i % 2 === 0 ? "GTPL Networks" : "Airtel Broadband",
    browser: BROWSERS[i % BROWSERS.length],
    os: i % 2 === 0 ? "macOS 15.4" : "Windows 11",
    device: DEVICES[i % DEVICES.length],
    createdAt: new Date(NOW - i * HOUR),
  };
}

function buildRepo() {
  const visitors = Array.from({ length: 57 }, (_, i) => makeVisitor(i + 1));
  const securityLogs = [
    {
      _id: "log_1",
      ip: "203.0.113.9",
      action: "FAILED_LOGIN",
      reason: "Repeated failed admin login attempts",
      createdAt: new Date(NOW - 2 * HOUR),
    },
  ];
  return createMemoryRepo({ visitors, securityLogs });
}

let server;
let baseUrl;
let repo;

function token() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "1h" });
}

function api(path, { method = "GET", body, auth: useToken = true } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useToken ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

before(async () => {
  repo = buildRepo();
  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo }));
  // Mirrors the legacy handler in server.js — proves the new router does not
  // shadow `DELETE /api/admin/visitors`.
  app.delete("/api/admin/visitors", auth, (req, res) => res.json({ legacy: true }));

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

// ── Authentication ───────────────────────────────────────────────────────────

test("rejects requests without a token", async () => {
  const res = await api("/api/admin/visitors", { auth: false });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "No token");
});

test("rejects an invalid token", async () => {
  const res = await fetch(`${baseUrl}/api/admin/visitors`, {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "Invalid token");
});

// ── Response shape ───────────────────────────────────────────────────────────

test("returns the documented list shape", async () => {
  const res = await api("/api/admin/visitors");
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.ok, true);
  assert.equal(body.total, 57);
  assert.equal(body.page, 1);
  assert.equal(body.limit, 50);
  assert.equal(body.totalPages, 2);
  assert.equal(body.range, "1–50 of 57");
  assert.equal(body.sort, "createdAt:desc");
  assert.deepEqual(body.pageSizes, [25, 50, 100, 200]);
  assert.equal(body.items.length, 50);

  const first = body.items[0];
  assert.equal(typeof first.visits, "number");
  assert.equal(typeof first.isReturning, "boolean");
  assert.equal(typeof first.bookmarked, "boolean");
  assert.equal(first._id, "visitor_001", "newest record first");
});

// ── Pagination boundaries ────────────────────────────────────────────────────

test("pages through every record exactly once", async () => {
  const seen = [];
  for (let page = 1; page <= 3; page++) {
    const res = await api(`/api/admin/visitors?page=${page}&limit=25`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.total, 57, "total stays consistent across pages");
    assert.equal(body.totalPages, 3);
    seen.push(...body.items.map((v) => v._id));
  }

  assert.equal(seen.length, 57, "every record is reachable");
  assert.equal(new Set(seen).size, 57, "no record is repeated across pages");

  const ordered = [...seen].sort();
  assert.deepEqual(
    ordered,
    Array.from({ length: 57 }, (_, i) => `visitor_${String(i + 1).padStart(3, "0")}`)
  );
});

test("labels the final partial page correctly", async () => {
  const body = await (await api("/api/admin/visitors?page=3&limit=25")).json();
  assert.equal(body.page, 3);
  assert.equal(body.items.length, 7);
  assert.equal(body.range, "51–57 of 57");
});

test("clamps a page past the end back to the last real page", async () => {
  const body = await (await api("/api/admin/visitors?page=999&limit=25")).json();
  assert.equal(body.ok, true);
  assert.equal(body.page, 3, "requested page is clamped");
  assert.equal(body.totalPages, 3);
  assert.equal(body.items.length, 7);
  assert.equal(body.range, "51–57 of 57", "range label matches the clamped page");
});

test("returns an honest empty page when a filter matches nothing", async () => {
  const body = await (await api("/api/admin/visitors?q=zzz-no-such-host&limit=25")).json();
  assert.equal(body.ok, true);
  assert.equal(body.total, 0);
  assert.equal(body.items.length, 0);
  assert.equal(body.range, "0 of 0");
  assert.equal(body.totalPages, 1, "an empty result still exposes page 1");
});

test("supports every whitelisted page size", async () => {
  for (const limit of [25, 50, 100, 200]) {
    const body = await (await api(`/api/admin/visitors?limit=${limit}`)).json();
    assert.equal(body.ok, true, `limit=${limit} accepted`);
    assert.equal(body.limit, limit);
    assert.equal(body.total, 57);
    assert.equal(body.items.length, Math.min(57, limit));
    assert.equal(body.totalPages, Math.ceil(57 / limit));
  }
});

// ── Invalid parameters ───────────────────────────────────────────────────────

test("rejects invalid pagination parameters with 400", async () => {
  for (const qs of ["limit=999", "limit=7", "limit=abc", "page=0", "page=-2", "page=1.5", "page=abc"]) {
    const res = await api(`/api/admin/visitors?${qs}`);
    assert.equal(res.status, 400, `${qs} must be rejected`);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(Array.isArray(body.errors), true);
    assert.equal(body.errors.length > 0, true);
  }
});

test("rejects duplicated query parameters", async () => {
  const res = await api("/api/admin/visitors?page=1&page=2");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.errors[0], /duplicate query parameter/);
});

test("rejects malformed dates, inverted ranges and unknown sort fields", async () => {
  const badDate = await (await api("/api/admin/visitors?from=not-a-date")).json();
  assert.equal(badDate.ok, false);
  assert.match(badDate.errors[0], /invalid date/);

  const inverted = await (await api("/api/admin/visitors?from=2026-02-01&to=2026-01-01")).json();
  assert.equal(inverted.ok, false);
  assert.match(inverted.errors[0], /from must be earlier/);

  const badSort = await (await api("/api/admin/visitors?sort=password")).json();
  assert.equal(badSort.ok, false);
  assert.match(badSort.errors[0], /sort must be one of/);

  const badOrder = await (await api("/api/admin/visitors?order=sideways")).json();
  assert.equal(badOrder.ok, false);
  assert.match(badOrder.errors[0], /order must be asc or desc/);
});

test("rejects an over-long search term instead of querying with it", async () => {
  const body = await (await api(`/api/admin/visitors?q=${"a".repeat(400)}`)).json();
  assert.equal(body.ok, false);
  assert.match(body.errors[0], /search query is too long/);
});

// ── Filters and totals ───────────────────────────────────────────────────────

test("applies the same filter to the records and the total", async () => {
  const filtered = await (await api("/api/admin/visitors?country=India&limit=200")).json();
  assert.equal(filtered.ok, true);

  const expected = repo.__countVisitors
    ? Array.from({ length: 57 }, (_, i) => makeVisitor(i + 1)).filter((v) => v.country === "India").length
    : null;
  assert.equal(filtered.total, expected, "total equals the number of matching records");
  assert.equal(filtered.items.length, expected);
  assert.equal(
    filtered.items.every((v) => v.country.toLowerCase() === "india"),
    true
  );
});

test("search matches across the whitelisted fields", async () => {
  const byIp = await (await api("/api/admin/visitors?q=10.0.0.5&limit=200")).json();
  assert.equal(byIp.ok, true);
  assert.equal(byIp.total > 0, true);
  assert.equal(byIp.items.every((v) => v.ip.includes("10.0.0.5")), true);

  const byBrowser = await (await api("/api/admin/visitors?q=Firefox&limit=200")).json();
  assert.equal(byBrowser.items.every((v) => v.browser.includes("Firefox")), true);
  assert.equal(byBrowser.total > 0, true);
});

test("combines search, filters and a date range", async () => {
  const body = await (
    await api("/api/admin/visitors?q=GTPL&country=India&from=2026-01-18&to=2026-01-20&limit=200")
  ).json();

  assert.equal(body.ok, true);
  for (const item of body.items) {
    assert.match(item.isp, /GTPL/i);
    assert.equal(item.country, "India");
    const t = Date.parse(item.createdAt);
    assert.ok(t >= Date.parse("2026-01-18T00:00:00.000Z"));
    assert.ok(t <= Date.parse("2026-01-20T23:59:59.999Z"));
  }
});

test("filters the visited page through `path`, not the pagination `page`", async () => {
  const body = await (await api("/api/admin/visitors?path=/admin&limit=200")).json();
  assert.equal(body.ok, true);
  assert.equal(body.items.every((v) => v.page === "/admin"), true);
  assert.equal(body.total > 0, true);
});

// ── Sorting ──────────────────────────────────────────────────────────────────

test("sorts on a whitelisted field in either direction", async () => {
  const asc = await (await api("/api/admin/visitors?sort=ip&order=asc&limit=200")).json();
  const ips = asc.items.map((v) => v.ip);
  assert.deepEqual(ips, [...ips].sort(), "plain lexicographic order");
  assert.equal(asc.sort, "ip:asc");

  const desc = await (await api("/api/admin/visitors?sort=ip&order=desc&limit=200")).json();
  assert.equal(desc.items[0].ip, ips[ips.length - 1]);
});

test("stays stable across pages when the sort key ties", async () => {
  const tied = Array.from({ length: 60 }, (_, i) => ({
    _id: `tie_${String(i + 1).padStart(3, "0")}`,
    ip: "198.51.100.7",
    country: "India",
    device: "Desktop",
    browser: "Chrome 154",
    page: "/",
    createdAt: new Date(NOW),
  }));
  const tiedRepo = createMemoryRepo({ visitors: tied });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo: tiedRepo }));

  const tiedServer = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const tiedBase = `http://127.0.0.1:${tiedServer.address().port}`;

  try {
    const seen = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(`${tiedBase}/api/admin/visitors?page=${page}&limit=25`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const body = await res.json();
      assert.equal(body.total, 60);
      seen.push(...body.items.map((v) => v._id));
    }
    assert.equal(seen.length, 60);
    assert.equal(new Set(seen).size, 60, "tie-broken by _id, no skips or repeats");
  } finally {
    tiedServer.close();
  }
});

// ── Enrichment ───────────────────────────────────────────────────────────────

test("enriches rows with visit counts and returning flags", async () => {
  const body = await (await api("/api/admin/visitors?limit=200")).json();
  const multi = body.items.filter((v) => v.visits > 1);
  assert.equal(multi.length > 0, true, "shared visitorIds produce visits > 1");
  assert.equal(multi.every((v) => v.isReturning === true), true);
  assert.equal(body.items.filter((v) => v.visits === 1).every((v) => v.isReturning === false), true);
});

// ── CSV export ───────────────────────────────────────────────────────────────

test("exports every matching row, not just the current page", async () => {
  const res = await api("/api/admin/visitors/export.csv?country=India");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(res.headers.get("content-disposition"), /ns-visitors-\d{4}-\d{2}-\d{2}\.csv/);

  const csv = await res.text();
  const lines = csv.trim().split("\r\n");
  assert.match(lines[0], /^IP,City,Region,Country/);

  const expected = Array.from({ length: 57 }, (_, i) => makeVisitor(i + 1)).filter(
    (v) => v.country === "India"
  ).length;
  assert.equal(lines.length - 1, expected, "export is not capped at one page");
  assert.equal(res.headers.get("x-export-row-count"), String(expected));
  assert.equal(res.headers.get("x-export-truncated"), "false");
});

test("neutralises spreadsheet formula injection in the CSV", async () => {
  const hostileRepo = createMemoryRepo({
    visitors: [
      {
        _id: "hostile_1",
        ip: "=cmd|'/C calc'!A0",
        country: "India",
        device: "Desktop",
        browser: "Chrome",
        page: "/",
        createdAt: new Date(NOW),
      },
    ],
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo: hostileRepo }));
  const s = await new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });

  try {
    const res = await fetch(`http://127.0.0.1:${s.address().port}/api/admin/visitors/export.csv`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const csv = await res.text();
    assert.equal(csv.includes("'=cmd"), true, "formula prefix is neutralised");
  } finally {
    s.close();
  }
});

// ── Bookmarks ────────────────────────────────────────────────────────────────

test("creates, lists, updates and removes a bookmark without touching history", async () => {
  const beforeCount = repo.__countVisitors();

  const created = await api("/api/admin/visitors/bookmarks", {
    method: "POST",
    body: { ip: "10.0.0.1", label: "Office VPN", notes: "Known good" },
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.bookmark.ip, "10.0.0.1");
  assert.equal(createdBody.bookmark.label, "Office VPN");

  const list = await (await api("/api/admin/visitors/bookmarks")).json();
  assert.equal(list.ok, true);
  assert.equal(list.total, 1);
  assert.equal(list.items[0].ip, "10.0.0.1");
  assert.equal(list.items[0].visits > 0, true, "joined with real visit stats");
  assert.equal(typeof list.items[0].firstSeen, "string");
  assert.equal(typeof list.items[0].lastSeen, "string");

  const listed = await (await api("/api/admin/visitors?limit=200")).json();
  assert.equal(listed.items.find((v) => v.ip === "10.0.0.1").bookmarked, true);

  const patched = await api("/api/admin/visitors/bookmarks/10.0.0.1", {
    method: "PATCH",
    body: { label: "Renamed" },
  });
  assert.equal(patched.status, 200);
  assert.equal((await patched.json()).bookmark.label, "Renamed");

  const removed = await api("/api/admin/visitors/bookmarks/10.0.0.1", { method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).historyPreserved, true);
  assert.equal(repo.__countVisitors(), beforeCount, "visitor history is untouched");

  const gone = await api("/api/admin/visitors/bookmarks/10.0.0.1", { method: "DELETE" });
  assert.equal(gone.status, 404);
});

test("validates bookmark payloads", async () => {
  const badIp = await api("/api/admin/visitors/bookmarks", {
    method: "POST",
    body: { ip: "not-an-ip" },
  });
  assert.equal(badIp.status, 400);
  assert.match((await badIp.json()).errors[0], /valid IPv4 or IPv6/);

  const noFields = await api("/api/admin/visitors/bookmarks/10.0.0.9", {
    method: "PATCH",
    body: {},
  });
  assert.equal(noFields.status, 400);

  const missingIp = await api("/api/admin/visitors/bookmarks/not-an-ip", { method: "DELETE" });
  assert.equal(missingIp.status, 400);
});

// ── Anomaly review persistence ───────────────────────────────────────────────

test("persists an anomaly review status and rejects unknown statuses", async () => {
  const ok = await api("/api/admin/visitors/anomalies/failed_logins:1.2.3.4", {
    method: "PATCH",
    body: { status: "resolved", notes: "Carrier NAT, not an attack" },
  });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).review.status, "resolved");

  const bad = await api("/api/admin/visitors/anomalies/failed_logins:1.2.3.4", {
    method: "PATCH",
    body: { status: "hacked" },
  });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).errors[0], /status must be one of/);
});

// ── Legacy route compatibility ───────────────────────────────────────────────

test("does not shadow the legacy DELETE /api/admin/visitors route", async () => {
  const res = await api("/api/admin/visitors", { method: "DELETE" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).legacy, true, "legacy handler still receives DELETE");
});

// ── Error handling ───────────────────────────────────────────────────────────

test("never leaks internal errors to the client", async () => {
  const brokenRepo = createMemoryRepo({ visitors: [] });
  brokenRepo.list = async () => {
    throw new Error("MongoNetworkError: connection to 10.9.8.7:27017 refused");
  };

  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo: brokenRepo }));
  const s = await new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });

  try {
    const res = await fetch(`http://127.0.0.1:${s.address().port}/api/admin/visitors`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "Failed to load visitors");
    assert.equal(JSON.stringify(body).includes("10.9.8.7"), false);
    assert.equal(JSON.stringify(body).includes("MongoNetworkError"), false);
  } finally {
    s.close();
  }
});
