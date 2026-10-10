import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  EXPORT_ROW_CAP,
  SORTABLE_FIELDS,
  parsePagination,
  buildVisitorFilter,
  buildVisitorSort,
  formatRangeLabel,
  totalPagesFor,
  pageWindow,
  sanitizeCsvCell,
  toCsv,
  isValidIp,
  validateBookmarkInput,
  validateBookmarkUpdate,
  validateReviewInput,
  anomalyKey,
  parseDateRangePreset,
  zeroFillSeries,
  escapeRegex,
} from "../src/visitorQuery.js";

test("parsePagination falls back to defaults for empty input", () => {
  const parsed = parsePagination();
  assert.deepEqual(
    { ok: parsed.ok, errors: parsed.errors, page: parsed.page, limit: parsed.limit, skip: parsed.skip },
    { ok: true, errors: [], page: 1, limit: DEFAULT_PAGE_SIZE, skip: 0 }
  );
});

test("parsePagination accepts every whitelisted page size", () => {
  for (const limit of PAGE_SIZES) {
    const parsed = parsePagination({ page: "3", limit: String(limit) });
    assert.equal(parsed.ok, true, `limit ${limit} should be allowed`);
    assert.equal(parsed.limit, limit);
    assert.equal(parsed.skip, 2 * limit);
  }
});

test("parsePagination rejects unknown page sizes and bad pages", () => {
  const badLimit = parsePagination({ limit: "999" });
  assert.equal(badLimit.ok, false);
  assert.equal(badLimit.errors[0], `limit must be one of ${PAGE_SIZES.join(", ")}`);
  assert.equal(badLimit.limit, DEFAULT_PAGE_SIZE, "falls back to default limit");

  for (const page of ["0", "-4", "1.5", "abc"]) {
    const parsed = parsePagination({ page });
    assert.equal(parsed.ok, false, `page=${page} must be rejected`);
    assert.equal(parsed.page, 1, "falls back to page 1");
  }

  assert.equal(parsePagination({ page: "10", limit: "7" }).ok, false);
});

test("buildVisitorFilter returns an empty filter for no query", () => {
  const built = buildVisitorFilter();
  assert.equal(built.ok, true);
  assert.deepEqual(built.filter, {});
});

test("buildVisitorFilter escapes regex metacharacters in the search term", () => {
  const built = buildVisitorFilter({ q: "1.2.3.4+os" });
  assert.equal(built.ok, true);
  const rx = built.filter.$or[0].ip;
  assert.equal(rx.$regex, "1\\.2\\.3\\.4\\+os");
  assert.equal(rx.$options, "i");
  assert.equal(built.filter.$or.length > 5, true, "search spans the whitelisted fields");
  assert.equal(
    built.filter.$or.some((clause) => Object.keys(clause)[0] === "sessionId"),
    true
  );
});

test("buildVisitorFilter rejects an over-long search term but keeps the filter safe", () => {
  const built = buildVisitorFilter({ q: "a".repeat(500) });
  assert.equal(built.ok, false);
  assert.equal(built.errors[0], "search query is too long");
  assert.equal(built.filter.$or, undefined, "no unbounded regex is emitted");
});

test("buildVisitorFilter anchors date-only bounds to UTC day edges", () => {
  const built = buildVisitorFilter({ from: "2026-01-15", to: "2026-01-20" });
  assert.equal(built.ok, true);
  assert.equal(built.filter.createdAt.$gte.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(built.filter.createdAt.$lte.toISOString(), "2026-01-20T23:59:59.999Z");
});

test("buildVisitorFilter rejects inverted or malformed dates", () => {
  const inverted = buildVisitorFilter({ from: "2026-02-01", to: "2026-01-01" });
  assert.equal(inverted.ok, false);
  assert.equal(inverted.errors[0], "from must be earlier than or equal to to");

  const malformed = buildVisitorFilter({ from: "not-a-date" });
  assert.equal(malformed.ok, false);
  assert.match(malformed.errors[0], /invalid date/);
});

test("buildVisitorFilter anchors exact fields and partial-match fields", () => {
  const exact = buildVisitorFilter({ country: "India", device: "Desktop" });
  assert.deepEqual(exact.filter.country, { $regex: "^India$", $options: "i" });
  assert.deepEqual(exact.filter.device, { $regex: "^Desktop$", $options: "i" });

  const partial = buildVisitorFilter({ browser: "Chrome", ip: "10.0.0" });
  assert.deepEqual(partial.filter.browser, { $regex: "Chrome", $options: "i" });
  assert.deepEqual(partial.filter.ip, { $regex: "10\\.0\\.0", $options: "i" });
});

test("buildVisitorFilter routes the visited page through `path`, never `page`", () => {
  const built = buildVisitorFilter({ path: "/contact", page: "4" });
  assert.equal(built.ok, true);
  assert.deepEqual(built.filter.page, { $regex: "^/contact$", $options: "i" });
  assert.equal(built.filter.$or, undefined, "page is not mistaken for pagination");
  assert.equal(built.filter.visitorPage, undefined);
});

test("buildVisitorFilter flags an over-long individual filter", () => {
  const built = buildVisitorFilter({ country: "X".repeat(500) });
  assert.equal(built.ok, false);
  assert.equal(built.filter.country, undefined, "oversized value is dropped, not queried");
});

test("buildVisitorSort defaults to newest-first with an _id tie-break", () => {
  const built = buildVisitorSort();
  assert.equal(built.ok, true);
  assert.deepEqual(built.sort, { createdAt: -1, _id: -1 });
});

test("buildVisitorSort honours a whitelisted field and direction", () => {
  const built = buildVisitorSort({ sort: "ip", order: "asc" });
  assert.equal(built.ok, true);
  assert.deepEqual(built.sort, { ip: 1, _id: 1 });
  assert.equal(built.field, "ip");
  assert.equal(built.direction, 1);
});

test("buildVisitorSort rejects arbitrary fields and directions", () => {
  const badField = buildVisitorSort({ sort: "password" });
  assert.equal(badField.ok, false);
  assert.deepEqual(badField.sort, { createdAt: -1, _id: -1 }, "keeps the safe default");

  const badOrder = buildVisitorSort({ order: "sideways" });
  assert.equal(badOrder.ok, false);
  assert.equal(badOrder.direction, -1);

  assert.equal(SORTABLE_FIELDS.includes("_id"), false, "_id is never client-selectable");
});

test("formatRangeLabel renders the table header label", () => {
  assert.equal(formatRangeLabel(0, 1, 50), "0 of 0");
  assert.equal(formatRangeLabel(5, 1, 50), "1–5 of 5");
  assert.equal(formatRangeLabel(120, 1, 50), "1–50 of 120");
  assert.equal(formatRangeLabel(120, 3, 50), "101–120 of 120", "last partial page");
  assert.equal(formatRangeLabel(2431, 49, 50), "2,401–2,431 of 2,431");
});

test("totalPagesFor never reports zero pages", () => {
  assert.equal(totalPagesFor(0, 50), 1);
  assert.equal(totalPagesFor(1, 50), 1);
  assert.equal(totalPagesFor(51, 50), 2);
  assert.equal(totalPagesFor(2431, 50), 49);
});

test("pageWindow keeps first, last and neighbours with ellipsis gaps", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 5), [1, 2, 3, "…", 5]);
  assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(49, 49), [1, "…", 47, 48, 49]);
});

test("sanitizeCsvCell neutralises spreadsheet formula injection", () => {
  assert.equal(sanitizeCsvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(sanitizeCsvCell("+1+2"), "'+1+2");
  assert.equal(sanitizeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(sanitizeCsvCell("-2+3"), "'-2+3");
  assert.equal(sanitizeCsvCell("10.25"), "10.25", "plain numbers stay numeric");
  assert.equal(sanitizeCsvCell("-12.5"), "-12.5", "negative numbers stay numeric");
  assert.equal(sanitizeCsvCell("2026-01-02"), "2026-01-02", "dates are not touched");
  assert.equal(sanitizeCsvCell("SAFE"), "SAFE");
  assert.equal(sanitizeCsvCell(null), "");
  assert.equal(sanitizeCsvCell(undefined), "");
  assert.equal(sanitizeCsvCell("a\u0000b\u007Fc"), "abc", "control characters stripped");
});

test("toCsv quotes, escapes and terminates rows with CRLF", () => {
  const csv = toCsv(
    [["a,b", 'say "hi"', "line1\nline2", "=1+1"]],
    ["c1", "c2", "c3", "c4"]
  );
  assert.equal(csv, 'c1,c2,c3,c4\r\n"a,b","say ""hi""","line1\nline2",\'=1+1');
  assert.equal(csv.endsWith("\r\n"), false, "rows are separated by CRLF, not terminated by it");
});

test("isValidIp accepts IPv4 and IPv6 and rejects junk", () => {
  assert.equal(isValidIp("192.168.1.1"), true);
  assert.equal(isValidIp("0.0.0.0"), true);
  assert.equal(isValidIp("255.255.255.255"), true);
  assert.equal(isValidIp("256.1.1.1"), false);
  assert.equal(isValidIp("1.2.3"), false);
  assert.equal(isValidIp("1.2.3.4.5"), false);
  assert.equal(isValidIp("::1"), true);
  assert.equal(isValidIp("2001:db8:85a3::8a2e:370:7334"), true);
  assert.equal(isValidIp("banana"), false);
  assert.equal(isValidIp(""), false);
  assert.equal(isValidIp(null), false);
  assert.equal(isValidIp("1.2.3.4; DROP TABLE"), false);
  assert.equal(isValidIp("x".repeat(60)), false, "length capped");
});

test("validateBookmarkInput enforces a valid IP and caps text", () => {
  const valid = validateBookmarkInput({ ip: "8.8.8.8", label: "Office VPN", notes: "Known good" });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { ip: "8.8.8.8", label: "Office VPN", notes: "Known good" });

  const badIp = validateBookmarkInput({ ip: "not-an-ip" });
  assert.equal(badIp.ok, false);
  assert.equal(badIp.errors[0], "ip must be a valid IPv4 or IPv6 address");

  const longLabel = validateBookmarkInput({ ip: "8.8.8.8", label: "L".repeat(500) });
  assert.equal(longLabel.ok, false);
  assert.match(longLabel.errors[0], /label must be 80 characters or fewer/);

  const controlChars = validateBookmarkInput({ ip: "8.8.8.8", label: "ok\u0000name" });
  assert.equal(controlChars.ok, true);
  assert.equal(controlChars.value.label, "okname");
});

test("validateBookmarkUpdate requires at least one field", () => {
  assert.equal(validateBookmarkUpdate({}).ok, false);
  assert.equal(validateBookmarkUpdate({}).errors[0], "provide label and/or notes");
  assert.equal(validateBookmarkUpdate({ label: 42 }).ok, false);
  assert.equal(validateBookmarkUpdate({ label: "a".repeat(99) }).ok, false);

  const partial = validateBookmarkUpdate({ notes: "only notes" });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.value, { notes: "only notes" });
  assert.equal("label" in partial.value, false, "unset fields are not written");
});

test("validateReviewInput restricts status to the known set", () => {
  for (const status of ["open", "in_review", "resolved", "false_positive"]) {
    assert.equal(validateReviewInput({ status }).ok, true, `${status} must be allowed`);
  }

  const bad = validateReviewInput({ status: "hacked" });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /status must be one of/);

  const longNotes = validateReviewInput({ status: "open", notes: "n".repeat(700) });
  assert.equal(longNotes.ok, false);
  assert.match(longNotes.errors[0], /notes must be 600 characters or fewer/);
});

test("anomalyKey produces stable URL-safe keys", () => {
  assert.equal(anomalyKey("traffic_spike", ["2026-01-05T00:00:00.000Z", 412]), "traffic_spike:2026-01-05T00:00:00.000Z:412", "colons are part of the allowed key alphabet");
  assert.equal(anomalyKey("failed_logins", ["1.2.3.4/56"]), "failed_logins:1.2.3.4_56");
  assert.equal(anomalyKey("x", ["a b/c"]), "x:a_b_c");
  assert.equal(anomalyKey("x", ["y".repeat(500)]).length <= 160, true, "key length is capped");
  assert.equal(anomalyKey("x"), "x");
});

test("parseDateRangePreset returns inclusive UTC day bounds", () => {
  const now = new Date("2026-03-15T10:30:00.000Z");
  assert.deepEqual(parseDateRangePreset("7d", now), { from: "2026-03-09", to: "2026-03-15" });
  assert.deepEqual(parseDateRangePreset("30d", now), { from: "2026-02-14", to: "2026-03-15" });
  assert.deepEqual(parseDateRangePreset("90d", now), { from: "2025-12-16", to: "2026-03-15" });
  assert.deepEqual(parseDateRangePreset("24h", now), { from: "2026-03-15", to: "2026-03-15" });
  assert.deepEqual(parseDateRangePreset("bogus", now), parseDateRangePreset("30d", now), "unknown presets fall back to 30d");
});

test("zeroFillSeries inserts empty days without inventing traffic", () => {
  const filled = zeroFillSeries(
    [{ key: "2026-03-10", pageViews: 7, sessions: 3, uniqueIps: 2 }],
    "2026-03-08",
    "2026-03-12",
    "day"
  );

  assert.equal(filled.length, 5);
  assert.deepEqual(filled.map((b) => b.key), [
    "2026-03-08",
    "2026-03-09",
    "2026-03-10",
    "2026-03-11",
    "2026-03-12",
  ]);
  assert.equal(filled[2].pageViews, 7, "real data survives");
  assert.equal(filled[0].pageViews, 0, "gap days are zero, not fabricated");
  assert.equal(filled[4].sessions, 0);
});

test("zeroFillSeries passes through input when the range is unusable", () => {
  const input = [{ key: "2026-03-10", pageViews: 7, sessions: 3, uniqueIps: 2 }];
  assert.equal(zeroFillSeries(input, "2026-03-12", "2026-03-08", "day"), input);
  assert.deepEqual(zeroFillSeries(input, "nope", "nope", "day"), input);
  assert.deepEqual(zeroFillSeries(null, "2026-03-08", "2026-03-12", "day").length, 5);
});

test("escapeRegex escapes every regex metacharacter", () => {
  assert.equal(escapeRegex("a+b*c?"), "a\\+b\\*c\\?");
  assert.equal(escapeRegex("[x]"), "\\[x\\]");
  assert.equal(escapeRegex("(y)"), "\\(y\\)");
  assert.equal(escapeRegex("plain"), "plain");
});

test("export cap stays a finite positive number", () => {
  assert.equal(Number.isInteger(EXPORT_ROW_CAP), true);
  assert.equal(EXPORT_ROW_CAP > 0, true);
});
