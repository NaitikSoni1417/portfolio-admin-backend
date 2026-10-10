/**
 * Streaming CSV export tests.
 *
 * Covers the upgraded `GET /api/admin/visitors/export.csv`: cursor-based
 * streaming, row-count headers, filters, empty results, formula injection
 * (including leading whitespace) and honest truncation flags.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import express from "express";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";
import { sanitizeCsvCell, toCsv, toCsvLine } from "../src/visitorQuery.js";

const NOW = "2026-01-10T12:00:00.000Z";

function makeVisitor(i, overrides = {}) {
  return {
    _id: `v${i}`,
    ip: `10.0.0.${i}`,
    country: "India",
    city: "Mumbai",
    region: "MH",
    isp: "Example ISP",
    browser: "Chrome",
    os: "Windows",
    device: "Desktop",
    page: "/",
    referrer: "",
    sessionId: `s${i}`,
    screen: "1920x1080",
    language: "en-US",
    timezone: "Asia/Kolkata",
    createdAt: new Date(NOW),
    ...overrides,
  };
}

function token() {
  return Buffer.from(JSON.stringify({ sub: "admin", role: "admin" })).toString("base64url");
}

async function startServer(repo) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/visitors", createVisitorRouter({ auth: (req, _res, next) => next(), repo }));
  return new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function api(srv, path) {
  return fetch(`http://127.0.0.1:${srv.address().port}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

test("sanitizeCsvCell neutralises formula chars after leading whitespace", () => {
  assert.equal(sanitizeCsvCell(" =cmd"), "' =cmd");
  assert.equal(sanitizeCsvCell("\t+1+2"), "'\t+1+2");
  assert.equal(sanitizeCsvCell("\r@SUM(A1)"), "'\r@SUM(A1)");
  assert.equal(sanitizeCsvCell("\n=1+1"), "'\n=1+1");
  assert.equal(sanitizeCsvCell("  -2+3"), "'  -2+3");
  assert.equal(sanitizeCsvCell("10.25"), "10.25", "plain numbers stay numeric");
  assert.equal(sanitizeCsvCell("SAFE"), "SAFE");
  assert.equal(sanitizeCsvCell(null), "");
});

test("toCsvLine produces one RFC4180 line without a trailing CRLF", () => {
  assert.equal(toCsvLine(["a", "b"]), "a,b");
  assert.equal(toCsvLine(['has,comma', 'has"quote']), '"has,comma","has""quote"');
  assert.equal(toCsvLine([]), "");
});

test("toCsv emits CRLF-joined RFC4180 output", () => {
  const csv = toCsv([["a", "b"], ["c", "d"]], ["H1", "H2"]);
  assert.equal(csv, "H1,H2\r\na,b\r\nc,d");
});

// ── Streaming export endpoint ─────────────────────────────────────────────────

test("streams every matching row with accurate row-count headers", async () => {
  const visitors = Array.from({ length: 60 }, (_, i) =>
    makeVisitor(i + 1, { country: i % 2 === 0 ? "India" : "USA" })
  );
  const repo = createMemoryRepo({ visitors });
  const srv = await startServer(repo);
  try {
    const res = await api(srv, "/api/admin/visitors/export.csv?country=India");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/csv/);
    assert.match(res.headers.get("content-disposition"), /ns-visitors-\d{4}-\d{2}-\d{2}\.csv/);

    const csv = await res.text();
    const lines = csv.trim().split("\r\n");
    assert.match(lines[0], /^IP,City,Region,Country/);

    const expected = visitors.filter((v) => v.country === "India").length;
    assert.equal(lines.length - 1, expected);
    assert.equal(res.headers.get("x-export-row-count"), String(expected));
    assert.equal(res.headers.get("x-export-truncated"), "false");
  } finally {
    srv.close();
  }
});

test("empty result yields a header-only CSV with zero rows, not an error", async () => {
  const repo = createMemoryRepo({ visitors: [makeVisitor(1)] });
  const srv = await startServer(repo);
  try {
    const res = await api(srv, "/api/admin/visitors/export.csv?country=Atlantis");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/csv/);
    assert.equal(res.headers.get("x-export-row-count"), "0");

    const csv = await res.text();
    const lines = csv.trim().split("\r\n");
    assert.equal(lines.length, 1, "only the header line");
    assert.match(lines[0], /^IP,City/);
  } finally {
    srv.close();
  }
});

test("neutralises formula injection, including leading whitespace before a formula char", async () => {
  const hostileRepo = createMemoryRepo({
    visitors: [
      makeVisitor(1, { ip: "=cmd|'/C calc'!A0" }),
      makeVisitor(2, { ip: " =1+1" }),
      makeVisitor(3, { country: "\t@SUM(A1)" }),
    ],
  });
  const srv = await startServer(hostileRepo);
  try {
    const res = await api(srv, "/api/admin/visitors/export.csv");
    const csv = await res.text();
    assert.equal(csv.includes("'=cmd"), true, "leading = is neutralised");
    assert.equal(csv.includes("' =1+1"), true, "leading space then = is neutralised");
    assert.equal(csv.includes("'\t@SUM"), true, "leading tab then @ is neutralised");
  } finally {
    srv.close();
  }
});

test("filter query params narrow the export like the list endpoint", async () => {
  const visitors = [
    makeVisitor(1, { country: "India", device: "Desktop" }),
    makeVisitor(2, { country: "USA", device: "Mobile" }),
    makeVisitor(3, { country: "India", device: "Mobile" }),
  ];
  const repo = createMemoryRepo({ visitors });
  const srv = await startServer(repo);
  try {
    const india = await api(srv, "/api/admin/visitors/export.csv?country=India");
    const indiaCsv = await india.text();
    assert.equal(indiaCsv.trim().split("\r\n").length - 1, 2);

    const mobile = await api(srv, "/api/admin/visitors/export.csv?device=Mobile");
    const mobileCsv = await mobile.text();
    assert.equal(mobileCsv.trim().split("\r\n").length - 1, 2);
    assert.equal(mobileCsv.includes("10.0.0.1"), false, "Desktop row excluded");
  } finally {
    srv.close();
  }
});

test("invalid filter params are a clean 400 before any CSV bytes are written", async () => {
  const repo = createMemoryRepo({ visitors: [makeVisitor(1)] });
  const srv = await startServer(repo);
  try {
    const res = await api(srv, "/api/admin/visitors/export.csv?country[]=India");
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.ok(Array.isArray(body.errors) && body.errors.length);
  } finally {
    srv.close();
  }
});

test("exportCursor streams rows and close() is safe to call twice", async () => {
  const repo = createMemoryRepo({
    visitors: Array.from({ length: 5 }, (_, i) => makeVisitor(i + 1)),
  });
  const handle = repo.exportCursor({ filter: {}, sort: { createdAt: -1 }, cap: 100 });
  const seen = [];
  for await (const doc of handle.stream()) {
    seen.push(doc._id);
  }
  assert.equal(seen.length, 5);
  await handle.close();
  await handle.close();
});

test("exportCursor honours the cap", async () => {
  const repo = createMemoryRepo({
    visitors: Array.from({ length: 10 }, (_, i) => makeVisitor(i + 1)),
  });
  const handle = repo.exportCursor({ filter: {}, sort: {}, cap: 3 });
  let count = 0;
  for await (const doc of handle.stream()) {
    assert.ok(doc, "each yielded row is a document");
    count += 1;
  }
  assert.equal(count, 3);
});

test("exportIps returns unique IPs from a filter without full documents", async () => {
  const repo = createMemoryRepo({
    visitors: [
      makeVisitor(1, { ip: "10.0.0.1" }),
      makeVisitor(2, { ip: "10.0.0.1" }),
      makeVisitor(3, { ip: "10.0.0.2" }),
    ],
  });
  const ips = await repo.exportIps({ filter: {}, cap: 100 });
  assert.equal(ips.length, 2);
  assert.deepEqual([...ips].sort(), ["10.0.0.1", "10.0.0.2"]);

  const capped = await repo.exportIps({ filter: {}, cap: 1 });
  assert.equal(capped.length, 1);
});

test("repo.count reports the full match count for a filter", async () => {
  const repo = createMemoryRepo({
    visitors: [
      makeVisitor(1, { country: "India" }),
      makeVisitor(2, { country: "India" }),
      makeVisitor(3, { country: "USA" }),
    ],
  });
  assert.equal(await repo.count({ filter: {} }), 3);
  assert.equal(await repo.count({ filter: { country: "India" } }), 2);
});
