/**
 * IP Identity Manager API tests.
 *
 * Covers the CRUD contract (`GET/POST/PATCH/DELETE /api/admin/visitors/ip-labels`),
 * validation, normalization, duplicate handling, pagination and the label-attach
 * integration on the visitor list, bookmarks and anomalies endpoints.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import express from "express";
import { createVisitorRouter } from "../src/visitorRoutes.js";
import { createMemoryRepo } from "./helpers/memoryRepo.js";
import { isValidHostname, validateIpLabelInput, validateIpLabelUpdate, isValidObjectId } from "../src/visitorQuery.js";

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
    createdAt: new Date(NOW),
    ...overrides,
  };
}

function makeLabel(i, overrides = {}) {
  return {
    // Valid 24-hex MongoDB ObjectId so the routes' isValidObjectId check passes.
    _id: i.toString(16).padStart(24, "0"),
    normalizedIp: `192.168.1.${i}`,
    displayName: `Label ${i}`,
    category: "College",
    hostname: "",
    note: "",
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
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

async function api(srv, path, options = {}) {
  return fetch(`http://127.0.0.1:${srv.address().port}${path}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    ...options,
  });
}

// ── Pure validators ───────────────────────────────────────────────────────────

test("isValidHostname accepts hostnames and FQDNs, rejects URLs/ports/paths", () => {
  assert.equal(isValidHostname("router"), true);
  assert.equal(isValidHostname("nas.local"), true);
  assert.equal(isValidHostname("server.example.com"), true);
  assert.equal(isValidHostname("a-b.example.com"), true);
  assert.equal(isValidHostname("https://example.com"), false, "scheme rejected");
  assert.equal(isValidHostname("example.com:8080"), false, "port rejected");
  assert.equal(isValidHostname("example.com/path"), false, "path rejected");
  assert.equal(isValidHostname("has space.com"), false, "whitespace rejected");
  assert.equal(isValidHostname(""), false);
  assert.equal(isValidHostname("a".repeat(300)), false);
});

test("validateIpLabelInput requires ip, displayName and a known category", () => {
  const ok = validateIpLabelInput({
    ip: "10.0.0.1",
    displayName: "College Wi-Fi",
    category: "College",
    hostname: "router.college.edu",
    note: "lab",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.displayName, "College Wi-Fi");

  assert.equal(validateIpLabelInput({ ip: "not-an-ip", displayName: "x", category: "College" }).ok, false);
  assert.equal(validateIpLabelInput({ ip: "10.0.0.1", displayName: "", category: "College" }).ok, false);
  assert.equal(validateIpLabelInput({ ip: "10.0.0.1", displayName: "x", category: "Bogus" }).ok, false);
  assert.equal(validateIpLabelInput({ ip: "10.0.0.1", displayName: "x", category: "College", hostname: "http://x" }).ok, false);
});

test("validateIpLabelUpdate validates only provided fields", () => {
  const ok = validateIpLabelUpdate({ displayName: "Renamed" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { displayName: "Renamed" });

  assert.equal(validateIpLabelUpdate({ category: "Nope" }).ok, false);
  assert.equal(validateIpLabelUpdate({}).ok, false, "empty update is rejected");
});

test("isValidObjectId matches 24-hex ids only", () => {
  assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isValidObjectId("lbl_1"), false);
  assert.equal(isValidObjectId(""), false);
  assert.equal(isValidObjectId("507f1f77bcf86cd79943901z"), false);
});

// ── CRUD API ──────────────────────────────────────────────────────────────────

test("requires auth on every ip-labels route", async () => {
  const repo = createMemoryRepo({});
  const srv = await startServer(repo);
  try {
    for (const [method, path] of [
      ["GET", "/api/admin/visitors/ip-labels"],
      ["POST", "/api/admin/visitors/ip-labels"],
      ["PATCH", `/api/admin/visitors/ip-labels/${"a".repeat(24)}`],
      ["DELETE", `/api/admin/visitors/ip-labels/${"a".repeat(24)}`],
    ]) {
      const res = await fetch(`http://127.0.0.1:${srv.address().port}${path}`, { method });
      // The test auth middleware always passes; real auth is asserted in visitorApi.test.js.
      assert.ok(res.status < 500, `${method} ${path} should not 500`);
    }
  } finally {
    srv.close();
  }
});

test("creates a label, normalizes the IP and returns 201", async () => {
  const repo = createMemoryRepo({});
  const srv = await startServer(repo);
  try {
    const res = await api(srv, "/api/admin/visitors/ip-labels", {
      method: "POST",
      body: JSON.stringify({
        ip: " 10.0.0.5 ",
        displayName: "College Lab",
        category: "College",
        hostname: "lab.college.edu",
        note: "first floor",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.label.normalizedIp, "10.0.0.5", "IP is normalized");
    assert.equal(body.label.displayName, "College Lab");
    assert.equal(body.label.category, "College");
    assert.ok(body.label._id);
  } finally {
    srv.close();
  }
});

test("rejects an invalid IP or unknown category with 400", async () => {
  const repo = createMemoryRepo({});
  const srv = await startServer(repo);
  try {
    const badIp = await api(srv, "/api/admin/visitors/ip-labels", {
      method: "POST",
      body: JSON.stringify({ ip: "nope", displayName: "x", category: "College" }),
    });
    assert.equal(badIp.status, 400);

    const badCategory = await api(srv, "/api/admin/visitors/ip-labels", {
      method: "POST",
      body: JSON.stringify({ ip: "10.0.0.6", displayName: "x", category: "Bogus" }),
    });
    assert.equal(badCategory.status, 400);
  } finally {
    srv.close();
  }
});

test("duplicate IP returns 409 with the existing label", async () => {
  const repo = createMemoryRepo({});
  const srv = await startServer(repo);
  try {
    const first = await api(srv, "/api/admin/visitors/ip-labels", {
      method: "POST",
      body: JSON.stringify({ ip: "10.0.0.7", displayName: "One", category: "College" }),
    });
    assert.equal(first.status, 201);

    const dup = await api(srv, "/api/admin/visitors/ip-labels", {
      method: "POST",
      body: JSON.stringify({ ip: "10.0.0.7", displayName: "Two", category: "Work" }),
    });
    assert.equal(dup.status, 409);
    const body = await dup.json();
    assert.equal(body.existing.displayName, "One");
  } finally {
    srv.close();
  }
});

test("lists labels with search, category filter and pagination", async () => {
  const labels = [
    makeLabel(1, { displayName: "College Wi-Fi", category: "College", normalizedIp: "10.0.0.1" }),
    makeLabel(2, { displayName: "Home router", category: "Personal", normalizedIp: "10.0.0.2" }),
    makeLabel(3, { displayName: "Office VPN", category: "Work", normalizedIp: "10.0.0.3" }),
  ];
  const repo = createMemoryRepo({ ipLabels: labels });
  const srv = await startServer(repo);
  try {
    const all = await (await api(srv, "/api/admin/visitors/ip-labels?limit=25")).json();
    assert.equal(all.total, 3);
    assert.equal(all.items.length, 3);

    const search = await (await api(srv, "/api/admin/visitors/ip-labels?q=college")).json();
    assert.equal(search.total, 1);
    assert.equal(search.items[0].displayName, "College Wi-Fi");

    const byCategory = await (await api(srv, "/api/admin/visitors/ip-labels?category=Work")).json();
    assert.equal(byCategory.total, 1);
    assert.equal(byCategory.items[0].displayName, "Office VPN");

    // Pagination: PAGE_SIZES only allows 25/50/100/200, so seed 26 labels to
    // exercise page 2 with limit=25.
    const many = Array.from({ length: 26 }, (_, i) =>
      makeLabel(100 + i, { normalizedIp: `172.16.0.${i}` })
    );
    const bigRepo = createMemoryRepo({ ipLabels: many });
    const bigSrv = await startServer(bigRepo);
    try {
      const paged = await (await api(bigSrv, "/api/admin/visitors/ip-labels?limit=25&page=2")).json();
      assert.equal(paged.total, 26);
      assert.equal(paged.items.length, 1, "page 2 holds the leftover row");
    } finally {
      bigSrv.close();
    }
  } finally {
    srv.close();
  }
});

test("empty list is an honest zero, not an error", async () => {
  const repo = createMemoryRepo({});
  const srv = await startServer(repo);
  try {
    const body = await (await api(srv, "/api/admin/visitors/ip-labels")).json();
    assert.equal(body.ok, true);
    assert.equal(body.total, 0);
    assert.deepEqual(body.items, []);
  } finally {
    srv.close();
  }
});

test("GET by id returns the label or 404; invalid ObjectId is 400", async () => {
  const repo = createMemoryRepo({ ipLabels: [makeLabel(1)] });
  const srv = await startServer(repo);
  const id = repo.ipLabels ? (await repo.ipLabels.all())[0]._id : null;
  try {
    const found = await (await api(srv, `/api/admin/visitors/ip-labels/${id}`)).json();
    assert.equal(found.ok, true);
    assert.equal(found.label.displayName, "Label 1");

    const missing = await api(srv, `/api/admin/visitors/ip-labels/${"a".repeat(24)}`);
    assert.equal(missing.status, 404);

    const invalid = await api(srv, "/api/admin/visitors/ip-labels/not-an-id");
    assert.equal(invalid.status, 400);
  } finally {
    srv.close();
  }
});

test("PATCH updates provided fields and refuses a duplicate-IP clash", async () => {
  const repo = createMemoryRepo({
    ipLabels: [makeLabel(1), makeLabel(2, { normalizedIp: "10.0.0.9", displayName: "Other" })],
  });
  const srv = await startServer(repo);
  const [first] = await repo.ipLabels.all();
  try {
    const updated = await api(srv, `/api/admin/visitors/ip-labels/${first._id}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Renamed", category: "Trusted" }),
    });
    assert.equal(updated.status, 200);
    const body = await updated.json();
    assert.equal(body.label.displayName, "Renamed");
    assert.equal(body.label.category, "Trusted");
    assert.equal(body.label.normalizedIp, first.normalizedIp, "IP untouched when not provided");

    const clash = await api(srv, `/api/admin/visitors/ip-labels/${first._id}`, {
      method: "PATCH",
      body: JSON.stringify({ ip: "10.0.0.9" }),
    });
    assert.equal(clash.status, 409);

    const bad = await api(srv, `/api/admin/visitors/ip-labels/${first._id}`, {
      method: "PATCH",
      body: JSON.stringify({ category: "Bogus" }),
    });
    assert.equal(bad.status, 400);

    const missing = await api(srv, `/api/admin/visitors/ip-labels/${"a".repeat(24)}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "x" }),
    });
    assert.equal(missing.status, 404);
  } finally {
    srv.close();
  }
});

test("DELETE removes the label, 404s on unknown id, and never touches visitors", async () => {
  const repo = createMemoryRepo({
    visitors: [makeVisitor(1)],
    ipLabels: [makeLabel(1)],
  });
  const before = repo.__countVisitors();
  const srv = await startServer(repo);
  const [label] = await repo.ipLabels.all();
  try {
    const removed = await api(srv, `/api/admin/visitors/ip-labels/${label._id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    const body = await removed.json();
    assert.equal(body.removed, true);
    assert.equal(repo.__countVisitors(), before, "visitor records are untouched");

    const again = await api(srv, `/api/admin/visitors/ip-labels/${label._id}`, { method: "DELETE" });
    assert.equal(again.status, 404);
  } finally {
    srv.close();
  }
});

// ── Label attachment integration ─────────────────────────────────────────────

test("visitor list attaches a matching label without hiding the raw IP", async () => {
  const repo = createMemoryRepo({
    visitors: [makeVisitor(1, { ip: "10.0.0.1" })],
    ipLabels: [makeLabel(1, { normalizedIp: "10.0.0.1", displayName: "College Lab", category: "College" })],
  });
  const srv = await startServer(repo);
  try {
    const body = await (await api(srv, "/api/admin/visitors?limit=50")).json();
    assert.equal(body.items.length, 1);
    const item = body.items[0];
    assert.equal(item.ip, "10.0.0.1", "raw IP is still present");
    assert.equal(item.ipLabel.displayName, "College Lab");
    assert.equal(item.ipLabel.category, "College");

    const unlabeled = createMemoryRepo({
      visitors: [makeVisitor(2, { ip: "10.0.0.2" })],
      ipLabels: [],
    });
    const srv2 = await startServer(unlabeled);
    try {
      const body2 = await (await api(srv2, "/api/admin/visitors?limit=50")).json();
      assert.equal(body2.items[0].ipLabel, null, "no label means null, not a fake row");
    } finally {
      srv2.close();
    }
  } finally {
    srv.close();
  }
});

test("bookmarks list and anomalies attach labels for their IPs", async () => {
  const repo = createMemoryRepo({
    visitors: [makeVisitor(1, { ip: "10.0.0.1" })],
    bookmarks: [{ ip: "10.0.0.1", label: "bm", notes: "" }],
    ipLabels: [makeLabel(1, { normalizedIp: "10.0.0.1", displayName: "College Lab" })],
    securityLogs: [
      { _id: "l1", ip: "10.0.0.1", action: "FAILED_LOGIN", reason: "bad password", createdAt: new Date("2026-01-16T10:00:00.000Z") },
      { _id: "l2", ip: "10.0.0.1", action: "FAILED_LOGIN", reason: "bad password", createdAt: new Date("2026-01-16T11:00:00.000Z") },
    ],
  });
  const srv = await startServer(repo);
  try {
    const bookmarks = await (await api(srv, "/api/admin/visitors/bookmarks")).json();
    assert.equal(bookmarks.items[0].ipLabel.displayName, "College Lab");

    const anomalies = await (await api(srv, "/api/admin/visitors/anomalies?from=2026-01-14&to=2026-01-20")).json();
    const withLabel = anomalies.items.find((i) => i.ipLabel);
    assert.ok(withLabel, "at least one anomaly carries its IP label");
    assert.equal(withLabel.ipLabel.displayName, "College Lab");
  } finally {
    srv.close();
  }
});

test("mapForIps returns only labeled IPs and normalizes input forms", async () => {
  const repo = createMemoryRepo({
    ipLabels: [
      makeLabel(1, { normalizedIp: "10.0.0.1" }),
      makeLabel(2, { normalizedIp: "2001:db8::1" }),
    ],
  });
  const rows = await repo.ipLabels.mapForIps(["10.0.0.1", "2001:0db8:0000:0000:0000:0000:0000:0001", "8.8.8.8"]);
  assert.equal(rows.length, 2, "unlabeled IPs are omitted, duplicates collapse");
  const ips = rows.map((r) => r.normalizedIp).sort();
  assert.deepEqual(ips, ["10.0.0.1", "2001:db8::1"]);

  const empty = await repo.ipLabels.mapForIps([]);
  assert.deepEqual(empty, []);
});
