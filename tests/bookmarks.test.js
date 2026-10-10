import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

import { auth } from "../src/middleware/auth.js";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";
import { normalizeIp, isValidIp, validateBookmarkInput } from "../src/visitorQuery.js";

const SECRET = "test-secret-for-bookmark-suite";
process.env.JWT_SECRET = SECRET;

const HOUR = 3600000;
const NOW = Date.parse("2026-02-01T09:00:00.000Z");

const SAVED_IP = "203.0.113.44";
const LONELY_IP = "198.51.100.7";
/** Carries 12 stored visits so the history panel has a real second page. */
const HISTORY_IP = "198.51.100.99";

function historyVisitors() {
  return Array.from({ length: 12 }, (_, i) => ({
    _id: `v_hist_${String(i + 1).padStart(2, "0")}`,
    ip: HISTORY_IP,
    page: ["/", "/projects", "/admin"][i % 3],
    country: "India",
    countryCode: "IN",
    city: "Vadodara",
    region: "Gujarat",
    isp: "Airtel Broadband",
    browser: "Chrome 154",
    os: "macOS 15.4",
    device: "Desktop",
    createdAt: new Date(NOW - (i + 1) * HOUR),
  }));
}

/** Visitors for SAVED_IP: 5 real stored records across 2 countries. */
function seedVisitors() {
  return [
    {
      _id: "v_sav_1",
      ip: SAVED_IP,
      page: "/",
      country: "India",
      countryCode: "IN",
      city: "Vadodara",
      region: "Gujarat",
      isp: "GTPL Networks",
      browser: "Chrome 154",
      os: "macOS 15.4",
      device: "Desktop",
      lat: 22.307,
      lng: 73.181,
      createdAt: new Date(NOW - 10 * HOUR),
    },
    {
      _id: "v_sav_2",
      ip: SAVED_IP,
      page: "/projects",
      country: "India",
      countryCode: "IN",
      city: "Vadodara",
      region: "Gujarat",
      isp: "GTPL Networks",
      browser: "Chrome 154",
      os: "macOS 15.4",
      device: "Desktop",
      createdAt: new Date(NOW - 8 * HOUR),
    },
    {
      _id: "v_sav_3",
      ip: SAVED_IP,
      page: "/admin",
      country: "India",
      countryCode: "IN",
      city: "Vadodara",
      region: "Gujarat",
      isp: "GTPL Networks",
      browser: "Chrome 154",
      os: "macOS 15.4",
      device: "Desktop",
      createdAt: new Date(NOW - 6 * HOUR),
    },
    {
      _id: "v_sav_4",
      ip: SAVED_IP,
      page: "/",
      country: "Germany",
      countryCode: "DE",
      city: "Frankfurt",
      region: "Hesse",
      isp: "Deutsche Telekom",
      browser: "Firefox 156",
      os: "Windows 11",
      device: "Mobile",
      createdAt: new Date(NOW - 3 * HOUR),
    },
    {
      _id: "v_sav_5",
      ip: SAVED_IP,
      page: "/contact",
      country: "Germany",
      countryCode: "DE",
      city: "Frankfurt",
      region: "Hesse",
      isp: "Deutsche Telekom",
      browser: "Firefox 156",
      os: "Windows 11",
      device: "Mobile",
      createdAt: new Date(NOW - 1 * HOUR),
    },
    // An IP that is never bookmarked — must survive every bookmark operation.
    {
      _id: "v_other_1",
      ip: LONELY_IP,
      page: "/",
      country: "United States",
      countryCode: "US",
      city: "Ashburn",
      region: "Virginia",
      isp: "Amazon.com",
      browser: "Safari 18",
      os: "iOS 19",
      device: "Mobile",
      createdAt: new Date(NOW - 2 * HOUR),
    },
  ];
}

let server;
let baseUrl;
let repo;

function token() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "1h" });
}

// Every path below is relative to the mounted router.
const PREFIX = "/api/admin/visitors";

function api(path, { method = "GET", body, auth: useToken = true } = {}) {
  return fetch(`${baseUrl}${PREFIX}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useToken ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(path, options) {
  const res = await api(path, options);
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  repo = createMemoryRepo({ visitors: [...seedVisitors(), ...historyVisitors()] });
  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth, repo }));

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

// ── IP validation and normalisation ─────────────────────────────────────────

test("isValidIp accepts IPv4 and IPv6 and rejects everything else", () => {
  for (const good of ["192.168.0.1", "0.0.0.0", "255.255.255.255", "::1", "2001:db8::1", "::"]) {
    assert.equal(isValidIp(good), true, `${good} should be valid`);
  }
  for (const bad of [
    "",
    "   ",
    "not-an-ip",
    "999.1.1.1",
    "1.2.3",
    "1.2.3.4.5",
    "2001:db8::1::2",
    "2001:db8:1:2:3:4:5:6:7",
    "2001:db8:::1",
    "zzzz::1",
    "1.2.3.4/24",
    "::ffff:1.2.3.4",
    "a".repeat(46),
  ]) {
    assert.equal(isValidIp(bad), false, `${JSON.stringify(bad)} should be invalid`);
  }
});

test("normalizeIp produces one stable key per address", () => {
  assert.equal(normalizeIp("192.168.0.1"), "192.168.0.1");
  assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
  assert.equal(normalizeIp("2001:0db8::1"), "2001:db8::1");
  assert.equal(normalizeIp("2001:db8:0:0:0:0:0:1"), "2001:db8::1");
  assert.equal(normalizeIp("0:0:0:0:0:0:0:1"), "::1");
  assert.equal(normalizeIp("FE80:0000:0000:0000:0000:0000:0000:0001"), "fe80::1");
  assert.equal(normalizeIp("garbage"), "", "invalid input normalises to empty");
});

test("normalizeIp is idempotent", () => {
  for (const ip of ["1.2.3.4", "2001:DB8::1", "::", "fe80::1"]) {
    assert.equal(normalizeIp(normalizeIp(ip)), normalizeIp(ip));
  }
});

test("validateBookmarkInput rejects invalid IPs and oversized text", () => {
  assert.equal(validateBookmarkInput({ ip: "nope" }).ok, false);
  assert.equal(validateBookmarkInput({}).ok, false);
  assert.equal(validateBookmarkInput({ ip: SAVED_IP, label: "x".repeat(81) }).ok, false);
  assert.equal(validateBookmarkInput({ ip: SAVED_IP, notes: "y".repeat(601) }).ok, false);

  const good = validateBookmarkInput({ ip: SAVED_IP, label: "  Office  ", notes: "Watch" });
  assert.equal(good.ok, true);
  assert.equal(good.value.ip, SAVED_IP);
  assert.equal(good.value.label, "Office", "label is trimmed");
  assert.equal(good.value.notes, "Watch");
});

// ── Creating bookmarks ──────────────────────────────────────────────────────

test("creating a bookmark persists it and reports created:true", async () => {
  const { status, body } = await json("/bookmarks", {
    method: "POST",
    body: { ip: SAVED_IP, label: "Home office", notes: "Recurring reader" },
  });

  assert.equal(status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.created, true);
  assert.equal(body.alreadyBookmarked, false);
  assert.equal(body.bookmark.ip, SAVED_IP);
  assert.equal(body.bookmark.label, "Home office");

  // Survives a fresh read — this is a real store, not component state.
  const listed = await json("/bookmarks");
  assert.equal(listed.body.total, 1);
  assert.equal(listed.body.items[0].label, "Home office");
});

test("bookmarking the same IP twice does not create a duplicate", async () => {
  const before = await repo.__countBookmarks();

  const first = await json("/bookmarks", { method: "POST", body: { ip: SAVED_IP, label: "A" } });
  const second = await json("/bookmarks", { method: "POST", body: { ip: SAVED_IP, label: "B" } });

  assert.equal(second.status, 201, "re-bookmarking is idempotent, not an error");
  assert.equal(second.body.created, false);
  assert.equal(second.body.alreadyBookmarked, true);

  const after = await repo.__countBookmarks();
  assert.equal(after, before, "bookmark count is unchanged");
  assert.equal(after, 1);

  const listed = await json("/bookmarks");
  assert.equal(listed.body.items[0].label, "B", "the later write wins");
});

test("IPv6 case and zero-padding variants collapse to one bookmark", async () => {
  await json("/bookmarks", { method: "POST", body: { ip: "2001:DB8::1" } });
  await json("/bookmarks", { method: "POST", body: { ip: "2001:0db8::1" } });
  await json("/bookmarks", { method: "POST", body: { ip: "2001:db8:0:0:0:0:0:1" } });

  const listed = await json("/bookmarks?q=2001");
  const matches = listed.body.items.filter((b) => b.ip.startsWith("2001:db8"));
  assert.equal(matches.length, 1, "one bookmark for every spelling of the same address");
  assert.equal(matches[0].ip, "2001:db8::1", "stored in canonical form");
});

test("creating a bookmark rejects an invalid IP with 400", async () => {
  const { status, body } = await json("/bookmarks", {
    method: "POST",
    body: { ip: "999.1.1.1" },
  });
  assert.equal(status, 400);
  assert.equal(body.ok, false);
  assert.match(body.errors[0], /valid IPv4 or IPv6/);
});

// ── Listing, search and pagination ──────────────────────────────────────────

test("bookmark list joins live visit metadata and paginates", async () => {
  // Seed enough extra bookmarks that limit=25 produces a real second page.
  for (let i = 1; i <= 30; i += 1) {
    await json("/bookmarks", { method: "POST", body: { ip: `192.0.2.${i}` } });
  }

  const page1 = await json("/bookmarks?page=1&limit=25");
  assert.equal(page1.status, 200);
  assert.equal(page1.body.ok, true);
  assert.equal(page1.body.items.length, 25);
  assert.equal(page1.body.limit, 25);
  assert.ok(page1.body.total >= 32);
  assert.deepEqual(page1.body.pageSizes, [25, 50, 100, 200]);

  const page2 = await json("/bookmarks?page=2&limit=25");
  assert.ok(page2.body.items.length > 0);
  assert.equal(page2.body.page, 2);
  assert.equal(
    page1.body.items.filter((i) => page2.body.items.some((j) => j.ip === i.ip)).length,
    0,
    "pages do not overlap"
  );

  // SAVED_IP was last seen before the bulk-seeded rows were created, so it
  // sorts below them — find it wherever it landed rather than assuming page 1.
  let saved = null;
  for (let p = 1; p <= page2.body.totalPages && !saved; p += 1) {
    const res = await json(`/bookmarks?page=${p}&limit=25`);
    saved = res.body.items.find((b) => b.ip === SAVED_IP) || null;
  }
  assert.ok(saved, "the seeded bookmark appears somewhere in the list");
  assert.equal(saved.visits, 5, "visit count comes from real stored records");
  assert.equal(saved.country, "Germany", "metadata reflects the most recent record");
  assert.equal(saved.countries.length, 2, "every country the endpoint was seen in");
});

test("search matches on ip, label, country and ISP", async () => {
  // Earlier tests overwrite the label, so set a known one for this assertion.
  await json(`/bookmarks/${SAVED_IP}`, { method: "PATCH", body: { label: "Home office" } });

  const byLabel = await json(`/bookmarks?q=${encodeURIComponent("Home office")}`);
  assert.ok(byLabel.body.items.some((b) => b.ip === SAVED_IP));

  const byCountry = await json("/bookmarks?q=Germany");
  assert.ok(byCountry.body.items.some((b) => b.ip === SAVED_IP));

  const byIsp = await json("/bookmarks?q=Deutsche");
  assert.ok(byIsp.body.items.some((b) => b.ip === SAVED_IP));

  const byIp = await json("/bookmarks?q=203.0.113.44");
  assert.equal(byIp.body.items.length, 1);

  const noMatch = await json("/bookmarks?q=definitely-not-present");
  assert.equal(noMatch.body.total, 0);
  assert.equal(noMatch.body.items.length, 0);
});

test("an out-of-range bookmark page clamps to the last real page", async () => {
  const limit = 25;
  const total = (await json(`/bookmarks?limit=${limit}`)).body.total;
  const lastPage = Math.max(1, Math.ceil(total / limit));

  const { body } = await json(`/bookmarks?page=999&limit=${limit}`);
  assert.equal(body.page, lastPage, "clamped instead of returning an empty page");
  assert.ok(body.items.length > 0);
  assert.ok(
    body.range.endsWith(`of ${total}`),
    `range reports the real total, got "${body.range}"`
  );
  assert.equal(body.totalPages, lastPage);
});

test("bookmark pagination rejects an invalid page size", async () => {
  const { status, body } = await json("/bookmarks?limit=7");
  assert.equal(status, 400);
  assert.equal(body.ok, false);
});

// ── Single bookmark and visit history ───────────────────────────────────────

test("GET /bookmarks/:ip returns one bookmark with real metadata", async () => {
  const { status, body } = await json(`/bookmarks/${SAVED_IP}`);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.bookmark.ip, SAVED_IP);
  assert.equal(body.bookmark.visits, 5);
  assert.equal(body.bookmark.city, "Frankfurt");
  assert.equal(body.bookmark.region, "Hesse");
  assert.equal(body.bookmark.isp, "Deutsche Telekom");
  assert.equal(body.bookmark.lat, null, "older records without coordinates stay null");
  assert.ok(body.bookmark.firstSeen);
  assert.ok(body.bookmark.lastSeen);
});

test("GET /bookmarks/:ip accepts an IPv6 case variant", async () => {
  const { status, body } = await json("/bookmarks/2001:DB8::1");
  assert.equal(status, 200);
  assert.equal(body.bookmark.ip, "2001:db8::1");
});

test("GET /bookmarks/:ip returns 404 for an unknown bookmark", async () => {
  const { status, body } = await json(`/bookmarks/${LONELY_IP}`);
  assert.equal(status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, "Bookmark not found");
});

test("GET /bookmarks/:ip rejects a malformed IP with 400", async () => {
  const { status, body } = await json("/bookmarks/not-an-ip");
  assert.equal(status, 400);
  assert.equal(body.ok, false);
});

test("visit history returns real stored records, newest first", async () => {
  const { status, body } = await json(`/bookmarks/${SAVED_IP}/history`);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.total, 5, "matches the number of stored visitor records");
  assert.equal(body.items.length, 5);

  const times = body.items.map((v) => Date.parse(v.createdAt));
  for (let i = 1; i < times.length; i += 1) {
    assert.ok(times[i - 1] >= times[i], "history is newest-first");
  }
  assert.deepEqual(
    body.items.map((v) => v._id),
    ["v_sav_5", "v_sav_4", "v_sav_3", "v_sav_2", "v_sav_1"]
  );
});

test("visit history paginates", async () => {
  await json("/bookmarks", { method: "POST", body: { ip: HISTORY_IP } });

  const page1 = await json(`/bookmarks/${HISTORY_IP}/history?page=1&limit=10`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.items.length, 10);
  assert.equal(page1.body.total, 12);
  assert.equal(page1.body.totalPages, 2);
  assert.equal(page1.body.page, 1);
  assert.deepEqual(page1.body.pageSizes, [10, 25, 50]);

  const page2 = await json(`/bookmarks/${HISTORY_IP}/history?page=2&limit=10`);
  assert.equal(page2.body.items.length, 2);
  assert.equal(page2.body.page, 2);
  assert.equal(
    page1.body.items.filter((a) => page2.body.items.some((b) => b._id === a._id)).length,
    0,
    "history pages do not overlap"
  );

  const clamped = await json(`/bookmarks/${HISTORY_IP}/history?page=50&limit=10`);
  assert.equal(clamped.body.page, 2);

  const badLimit = await json(`/bookmarks/${HISTORY_IP}/history?limit=7`);
  assert.equal(badLimit.status, 400, "history rejects page sizes outside its ladder");
});

test("visit history 404s for an IP that was never bookmarked", async () => {
  const { status, body } = await json(`/bookmarks/${LONELY_IP}/history`);
  assert.equal(status, 404);
  assert.equal(body.error, "Bookmark not found");
});

// ── Updating ────────────────────────────────────────────────────────────────

test("PATCH updates label and notes without touching history", async () => {
  const before = await repo.__countVisitors();

  const { status, body } = await json(`/bookmarks/${SAVED_IP}`, {
    method: "PATCH",
    body: { label: "Renamed", notes: "Updated notes" },
  });

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.bookmark.label, "Renamed");
  assert.equal(body.bookmark.notes, "Updated notes");
  assert.equal(await repo.__countVisitors(), before, "visitor records untouched");
});

test("PATCH rejects an empty update and an unknown bookmark", async () => {
  const empty = await json(`/bookmarks/${SAVED_IP}`, { method: "PATCH", body: {} });
  assert.equal(empty.status, 400);

  const unknown = await json(`/bookmarks/${LONELY_IP}`, {
    method: "PATCH",
    body: { label: "x" },
  });
  assert.equal(unknown.status, 404);
});

// ── Removing ────────────────────────────────────────────────────────────────

test("removing a bookmark never deletes the underlying visitor records", async () => {
  const visitorsBefore = await repo.__countVisitors();
  const bookmarksBefore = await repo.__countBookmarks();
  assert.ok(visitorsBefore > 0);

  const { status, body } = await json(`/bookmarks/${SAVED_IP}`, { method: "DELETE" });

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.removed, true);
  assert.equal(body.historyPreserved, true);

  assert.equal(await repo.__countBookmarks(), bookmarksBefore - 1, "one bookmark row gone");
  assert.equal(
    await repo.__countVisitors(),
    visitorsBefore,
    "every visitor record is still there"
  );

  // The bookmark endpoint itself now 404s…
  const gone = await json(`/bookmarks/${SAVED_IP}`);
  assert.equal(gone.status, 404, "the bookmark itself is gone");

  // …but the visitor records are still in the collection, intact.
  const stillStored = await repo.bookmarkHistory({ ip: SAVED_IP, skip: 0, limit: 100 });
  assert.equal(stillStored.total, 5, "visit history survives bookmark removal");
});

test("removing an unknown bookmark returns 404", async () => {
  const { status, body } = await json(`/bookmarks/${SAVED_IP}`, { method: "DELETE" });
  assert.equal(status, 404);
  assert.equal(body.error, "Bookmark not found");
});

test("removing a bookmark rejects a malformed IP", async () => {
  const { status, body } = await json("/bookmarks/definitely-not-an-ip", { method: "DELETE" });
  assert.equal(status, 400);
  assert.equal(body.ok, false);
});

// ── Authorization ───────────────────────────────────────────────────────────

test("every bookmark endpoint rejects an unauthenticated request", async () => {
  const cases = [
    ["/bookmarks", "GET"],
    ["/bookmarks", "POST"],
    [`/bookmarks/${SAVED_IP}`, "GET"],
    [`/bookmarks/${SAVED_IP}/history`, "GET"],
    [`/bookmarks/${SAVED_IP}`, "PATCH"],
    [`/bookmarks/${SAVED_IP}`, "DELETE"],
  ];

  for (const [path, method] of cases) {
    const res = await api(path, { method, auth: false, body: method === "GET" ? undefined : {} });
    assert.equal(res.status, 401, `${method} ${path} must require auth`);
  }
});

test("a garbage token is rejected", async () => {
  const res = await fetch(`${baseUrl}${PREFIX}/bookmarks`, {
    headers: { Authorization: "Bearer not.a.jwt" },
  });
  assert.equal(res.status, 401);
});

// ── The visitor list reflects persisted bookmarks ───────────────────────────

test("GET / marks rows as bookmarked from the persisted store", async () => {
  await json("/bookmarks", { method: "POST", body: { ip: LONELY_IP, label: "Now saved" } });

  const { body } = await json(`/bookmarks/${LONELY_IP}`);
  assert.equal(body.bookmark.label, "Now saved");

  const listed = await json(`/?q=${encodeURIComponent(LONELY_IP)}`);
  const row = listed.body.items.find((v) => v.ip === LONELY_IP);
  assert.ok(row, "the visitor record is still listed");
  assert.equal(row.bookmarked, true, "the list reads the persisted bookmark store");

  await json(`/bookmarks/${LONELY_IP}`, { method: "DELETE" });

  const after = await json(`/?q=${encodeURIComponent(LONELY_IP)}`);
  const rowAfter = after.body.items.find((v) => v.ip === LONELY_IP);
  assert.equal(rowAfter.bookmarked, false, "unbookmarking clears the flag");
  assert.ok(rowAfter, "and the visitor record itself is untouched");
});

test("the whole flow survives a fresh repository read (persistence)", async () => {
  const { body } = await json("/bookmarks");
  assert.ok(body.total >= 1);

  // Re-read through a completely separate query — not component state.
  const again = await json(`/bookmarks?page=1&limit=${body.total > 200 ? 200 : 50}`);
  assert.ok(again.body.items.length >= 1);
  assert.equal(again.body.ok, true);
});
