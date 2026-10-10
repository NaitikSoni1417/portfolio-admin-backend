/**
 * Pure, side-effect free helpers for the NS Visitor Intelligence Center.
 * No I/O, no Mongoose, no environment access — unit testable with `node --test`.
 */

export const PAGE_SIZES = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 120;
export const MAX_FILTER_LENGTH = 120;
export const EXPORT_ROW_CAP = 50000;

export const SORTABLE_FIELDS = [
  "createdAt",
  "ip",
  "country",
  "city",
  "page",
  "device",
  "browser",
  "isp",
];

export const BOOKMARK_LABEL_MAX = 80;
export const BOOKMARK_NOTES_MAX = 600;
export const ANOMALY_NOTES_MAX = 600;
export const ANOMALY_STATUSES = ["open", "in_review", "resolved", "false_positive"];
export const ANOMALY_SEVERITIES = ["high", "medium", "low"];
export const ANOMALY_TYPES = [
  "traffic_spike",
  "high_volume_endpoint",
  "failed_logins",
  "firewall_block",
];
export const ANOMALY_PAGE_SIZES = [10, 25, 50];
export const ANOMALY_DEFAULT_PAGE_SIZE = 25;

/** Admin IP-label fields (IP Identity Manager). */
export const IP_LABEL_NAME_MAX = 80;
export const IP_LABEL_HOSTNAME_MAX = 253;
export const IP_LABEL_NOTE_MAX = 600;
/** Predefined categories — "Other" is a category, not free-text. */
export const IP_LABEL_CATEGORIES = [
  "College",
  "Personal",
  "Friend",
  "Work",
  "Server",
  "Research",
  "Trusted",
  "Unknown",
  "Other",
];

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function str(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse and validate `page` / `limit`. Never throws — problems land in `errors`
 * so the caller can decide between 400 and a safe fallback.
 */
/**
 * Parse `page` / `limit` from a query string.
 *
 * `pageSizes` and `defaultLimit` let a caller opt into a smaller ladder — the
 * bookmark visit-history panel only needs a handful of rows per page, and
 * forcing it to 25 would waste the request.
 */
export function parsePagination(query = {}, { pageSizes = PAGE_SIZES, defaultLimit = DEFAULT_PAGE_SIZE } = {}) {
  const errors = [];

  const rawPage = str(query.page);
  const rawLimit = str(query.limit ?? query.pageSize);

  let page = 1;
  if (rawPage !== "") {
    const parsed = Number(rawPage);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push("page must be a positive integer");
    } else {
      page = parsed;
    }
  }

  let limit = defaultLimit;
  if (rawLimit !== "") {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || !pageSizes.includes(parsed)) {
      errors.push(`limit must be one of ${pageSizes.join(", ")}`);
    } else {
      limit = parsed;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    page,
    limit,
    skip: (page - 1) * limit,
    pageSizes,
  };
}

function parseDateBoundary(value, endOfDay) {
  const raw = str(value);
  if (raw === "") return { ok: true, value: undefined };

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (!dateOnly && Number.isNaN(Date.parse(raw))) {
    return { ok: false, error: `invalid date: ${raw}` };
  }

  const date = dateOnly
    ? new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return { ok: false, error: `invalid date: ${raw}` };
  return { ok: true, value: date };
}

function exactMatch(field, value, errors) {
  const v = str(value);
  if (v === "") return undefined;
  if (v.length > MAX_FILTER_LENGTH) {
    errors.push(`${field} filter is too long`);
    return undefined;
  }
  return { $regex: `^${escapeRegex(v)}$`, $options: "i" };
}

function partialMatch(field, value, errors) {
  const v = str(value);
  if (v === "") return undefined;
  if (v.length > MAX_FILTER_LENGTH) {
    errors.push(`${field} filter is too long`);
    return undefined;
  }
  return { $regex: escapeRegex(v), $options: "i" };
}

const SEARCH_FIELDS = [
  "ip",
  "visitorId",
  "city",
  "region",
  "country",
  "countryCode",
  "isp",
  "page",
  "browser",
  "os",
  "device",
  "referrer",
  "sessionId",
];

const EXACT_FIELDS = ["country", "device", "os", "city", "referrer"];
const PARTIAL_FIELDS = ["browser", "isp", "ip"];

/**
 * Build a validated MongoDB filter from raw query-string input.
 * Returns `{ ok, errors, filter }`.
 */
export function buildVisitorFilter(query = {}) {
  const errors = [];
  const filter = {};

  const rawQuery = str(query.q ?? query.search);
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    errors.push("search query is too long");
  } else if (rawQuery !== "") {
    const rx = { $regex: escapeRegex(rawQuery), $options: "i" };
    filter.$or = SEARCH_FIELDS.map((field) => ({ [field]: rx }));
  }

  const from = parseDateBoundary(query.from ?? query.startDate, false);
  const to = parseDateBoundary(query.to ?? query.endDate, true);
  if (!from.ok) errors.push(from.error);
  if (!to.ok) errors.push(to.error);
  if (from.ok && to.ok && from.value && to.value && from.value.getTime() > to.value.getTime()) {
    errors.push("from must be earlier than or equal to to");
  }

  if (from.ok && from.value) filter.createdAt = { ...(filter.createdAt || {}), $gte: from.value };
  if (to.ok && to.value) filter.createdAt = { ...(filter.createdAt || {}), $lte: to.value };

  for (const field of EXACT_FIELDS) {
    const cond = exactMatch(field, query[field], errors);
    if (cond) filter[field] = cond;
  }

  for (const field of PARTIAL_FIELDS) {
    const cond = partialMatch(field, query[field], errors);
    if (cond) filter[field] = cond;
  }

  // Visited page — named `path` so it never collides with pagination `page`.
  const visitedPage = query.path ?? query.visitedPage ?? query.pagePath;
  const pathCond = exactMatch("page", visitedPage, errors);
  if (pathCond) filter.page = pathCond;

  return { ok: errors.length === 0, errors, filter };
}

/**
 * Stable sort: whitelisted field + direction, always tie-broken by `_id` in the
 * same direction so a page boundary can never repeat or skip a row.
 */
export function buildVisitorSort(query = {}, allowed = SORTABLE_FIELDS) {
  const errors = [];
  const raw = str(query.sort);
  const rawOrder = str(query.order ?? query.dir);

  let field = "createdAt";
  let direction = -1;

  if (raw !== "") {
    if (!allowed.includes(raw)) {
      errors.push(`sort must be one of ${allowed.join(", ")}`);
    } else {
      field = raw;
    }
  }

  if (rawOrder !== "") {
    const normalized = rawOrder.toLowerCase();
    if (normalized !== "asc" && normalized !== "desc") {
      errors.push("order must be asc or desc");
    } else {
      direction = normalized === "asc" ? 1 : -1;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    sort: { [field]: direction, _id: direction },
    field,
    direction,
  };
}

export function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}

/**
 * Canonical device labels. The parser occasionally emits `mobile` and `Mobile`
 * for the same thing; folding case is a display fix, not an invention.
 */
const DEVICE_LABELS = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  bot: "Bot",
  crawler: "Bot",
  spider: "Bot",
  smarttv: "Smart TV",
  "smart tv": "Smart TV",
  console: "Console",
  wearable: "Wearable",
  unknown: "Unknown",
};

export function normalizeDeviceLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  if (DEVICE_LABELS[lower]) return DEVICE_LABELS[lower];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Canonical operating-system families. "Windows 11" and "Windows 10" fold to
 * "Windows" so the distribution chart is readable; the raw string is still
 * available on every visitor record in the table.
 */
const OS_FAMILIES = [
  ["windows", "Windows"],
  ["macos", "macOS"],
  ["mac os", "macOS"],
  ["mac os x", "macOS"],
  ["mac", "macOS"],
  ["ios", "iOS"],
  ["iphone os", "iOS"],
  ["ipad os", "iOS"],
  ["android", "Android"],
  ["chrome os", "Chrome OS"],
  ["chromeos", "Chrome OS"],
  ["linux", "Linux"],
  ["ubuntu", "Ubuntu"],
  ["fedora", "Fedora"],
  ["harmonyos", "HarmonyOS"],
  ["other", "Unknown"],
  ["unknown", "Unknown"],
];

export function normalizeOsLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  for (const [key, label] of OS_FAMILIES) {
    if (lower === key || lower.startsWith(`${key} `)) return label;
  }
  return raw;
}

/**
 * Canonical browser families. The UA parser stores "Chrome 150", "Chrome 151",
 * "Mobile Chrome 151"… as distinct values; folding them to one family makes the
 * distribution chart readable. Order matters — Edge, Opera, Brave, Vivaldi,
 * Samsung, UC, Instagram and Yahoo all send a UA string containing another
 * browser's name, so they are checked first.
 */
const BROWSER_FAMILIES = [
  [/\bedg[e]?\b|edga|edgios|edge\//i, "Edge"],
  [/\bopr\b|opera|opt\/|opera mini|opera mobi/i, "Opera"],
  [/vivaldi/i, "Vivaldi"],
  [/brave/i, "Brave"],
  [/samsung/i, "Samsung Internet"],
  [/uc ?browser|ucweb|\buc\b/i, "UC Browser"],
  [/yabrowser|yahoo/i, "Yahoo Browser"],
  [/instagram/i, "Instagram"],
  [/tor browser|\btor\b/i, "Tor"],
  [/electron/i, "Electron"],
  [/chrome|crios|chromium|headless chrome|headless/i, "Chrome"],
  [/firefox|fxios|iceweasel|seamonkey/i, "Firefox"],
  [/safari/i, "Safari"],
  [/\bie\b|msie|trident|internet explorer/i, "Internet Explorer"],
  [
    /curl|wget|postman|insomnia|python|requests|node|okhttp|go-http|java|axios|libwww|scrapy|httpie|bot|crawler|spider|scanner|monitoring|uptime/i,
    "Bot",
  ],
];

export function normalizeBrowserLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  for (const [pattern, label] of BROWSER_FAMILIES) {
    if (pattern.test(raw)) return label;
  }
  // A bare version string the parser emitted for a family already seen above
  // still folds in via the regexes; anything truly unknown keeps its own name.
  return raw;
}

/** Trim a facet value to a bounded, non-empty display string. */
export function facetLabel(value, max = 80) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
}

/** `"1–50 of 2,431"` — the exact label the table header renders. */
export function formatRangeLabel(total, page, limit) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Number(limit) : DEFAULT_PAGE_SIZE;

  if (safeTotal === 0) return "0 of 0";

  const start = (safePage - 1) * safeLimit + 1;
  const end = Math.min(safePage * safeLimit, safeTotal);
  return `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(safeTotal)}`;
}

export function totalPagesFor(total, limit) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safeLimit = Number(limit) > 0 ? Number(limit) : DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.ceil(safeTotal / safeLimit));
}

/** Inclusive page list, e.g. `[1, 2, 3, "…", 48]`. */
export function pageWindow(page, totalPages, span = 2) {
  const pages = new Set();
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= span) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Spreadsheet formula injection guard (OWASP): anything that a spreadsheet would
 * parse as a formula gets a leading apostrophe. Leading whitespace and control
 * characters are stripped for the *check* (Excel/Sheets trim before parsing),
 * but the original cell content is preserved — only the guard prefix is added.
 * Plain numbers keep their value.
 */
export function sanitizeCsvCell(value) {
  let cell = value === undefined || value === null ? "" : String(value);
  cell = cell.replace(CONTROL_CHARS, "");
  // Check the form a spreadsheet would see: leading spaces/tabs trimmed.
  const probe = cell.replace(/^[ \t\r\n]+/, "");
  if (/^[=+\-@]/.test(probe) && !/^[+-]?\d+(\.\d+)?$/.test(probe)) {
    cell = `'${cell}`;
  }
  return cell;
}

function csvQuote(value) {
  const cell = sanitizeCsvCell(value);
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

/** One CSV line (no trailing CRLF) — used by the streaming exporter. */
export function toCsvLine(values) {
  return (values || []).map(csvQuote).join(",");
}

/** RFC4180 CSV, CRLF line endings, formula-safe. */
export function toCsv(rows, headers) {
  const lines = [];
  if (headers && headers.length) lines.push(toCsvLine(headers));
  for (const row of rows || []) lines.push(toCsvLine(row));
  return lines.join("\r\n");
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

export function isValidIp(value) {
  const ip = str(value);
  if (ip === "" || ip.length > 45) return false;
  if (IPV4.test(ip)) return true;
  if (!/^[0-9a-f:]+$/i.test(ip)) return false;

  // IPv6. `::` may appear at most once and must stand in for one or more
  // zero groups, so `:::`, a second `::`, and >7 explicit groups are all out.
  const at = ip.indexOf("::");
  if (at !== -1) {
    if (ip.indexOf("::", at + 1) !== -1) return false;
    const head = at === 0 ? [] : ip.slice(0, at).split(":");
    const tail = at + 2 === ip.length ? [] : ip.slice(at + 2).split(":");
    if (head.length + tail.length > 7) return false;
    return [...head, ...tail].every((g) => HEX_GROUP.test(g));
  }

  const groups = ip.split(":");
  if (groups.length !== 8) return false;
  return groups.every((g) => HEX_GROUP.test(g));
}

/**
 * Stable canonical form used as the bookmark key.
 *
 * Without this, `2001:DB8::1`, `2001:0db8::1` and `2001:db8:0:0:0:0:0:1` would
 * each become a separate bookmark for the same machine. IPv4 is already
 * canonical, so it is returned untouched.
 *
 * IPv4-mapped IPv6 (e.g. `::ffff:1.2.3.4`) is intentionally not accepted by
 * `isValidIp` and therefore cannot reach this function.
 */
export function normalizeIp(value) {
  const ip = str(value);
  if (!isValidIp(ip)) return "";
  if (IPV4.test(ip)) return ip;

  // `isValidIp` already guaranteed well-formed hex groups, so this only has to
  // strip leading zeros and lower-case.
  const trim = (groups) =>
    groups.map((g) => {
      const hex = g.replace(/^0+/, "");
      return hex === "" ? "0" : hex.toLowerCase();
    });

  if (!ip.includes("::")) return compressGroups(trim(ip.split(":")));

  const at = ip.indexOf("::");
  const head = trim(at === 0 ? [] : ip.slice(0, at).split(":"));
  const tail = trim(at + 2 === ip.length ? [] : ip.slice(at + 2).split(":"));
  const fill = 8 - head.length - tail.length;

  return compressGroups([...head, ...Array(fill).fill("0"), ...tail]);
}

/** Expand-then-recompress so `::` always covers the longest zero run. */
function compressGroups(groups) {
  let bestStart = -1;
  let bestLen = 0;
  let start = -1;

  for (let i = 0; i <= groups.length; i += 1) {
    if (i < groups.length && groups[i] === "0") {
      if (start === -1) start = i;
      const len = i - start + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = start;
      }
    } else {
      start = -1;
    }
  }

  if (bestLen < 2) return groups.join(":");
  const left = groups.slice(0, bestStart).join(":");
  const right = groups.slice(bestStart + bestLen).join(":");
  return `${left}::${right}`;
}

function sanitizeText(value, max) {
  let text = value === undefined || value === null ? "" : String(value);
  text = text.replace(CONTROL_CHARS, "");
  if (text.length > max) text = text.slice(0, max);
  return text.trim();
}

export function validateBookmarkInput(body = {}) {
  const errors = [];
  const ip = str(body.ip);
  if (!isValidIp(ip)) errors.push("ip must be a valid IPv4 or IPv6 address");

  if (str(body.label).length > BOOKMARK_LABEL_MAX) {
    errors.push(`label must be ${BOOKMARK_LABEL_MAX} characters or fewer`);
  }
  if (str(body.notes).length > BOOKMARK_NOTES_MAX) {
    errors.push(`notes must be ${BOOKMARK_NOTES_MAX} characters or fewer`);
  }

  return {
    ok: errors.length === 0,
    errors,
    value: { ip, label: sanitizeText(body.label, BOOKMARK_LABEL_MAX), notes: sanitizeText(body.notes, BOOKMARK_NOTES_MAX) },
  };
}

export function validateBookmarkUpdate(body = {}) {
  const errors = [];
  if (body.label === undefined && body.notes === undefined) {
    errors.push("provide label and/or notes");
  }
  if (body.label !== undefined && typeof body.label !== "string") errors.push("label must be a string");
  if (body.notes !== undefined && typeof body.notes !== "string") errors.push("notes must be a string");
  if (str(body.label).length > BOOKMARK_LABEL_MAX) errors.push(`label must be ${BOOKMARK_LABEL_MAX} characters or fewer`);
  if (str(body.notes).length > BOOKMARK_NOTES_MAX) errors.push(`notes must be ${BOOKMARK_NOTES_MAX} characters or fewer`);

  const value = {};
  if (body.label !== undefined) value.label = sanitizeText(body.label, BOOKMARK_LABEL_MAX);
  if (body.notes !== undefined) value.notes = sanitizeText(body.notes, BOOKMARK_NOTES_MAX);
  return { ok: errors.length === 0, errors, value };
}

export function validateReviewInput(body = {}) {
  const errors = [];
  const status = str(body.status);
  if (!ANOMALY_STATUSES.includes(status)) {
    errors.push(`status must be one of ${ANOMALY_STATUSES.join(", ")}`);
  }
  if (str(body.notes).length > ANOMALY_NOTES_MAX) {
    errors.push(`notes must be ${ANOMALY_NOTES_MAX} characters or fewer`);
  }
  return {
    ok: errors.length === 0,
    errors,
    value: { status, notes: sanitizeText(body.notes, ANOMALY_NOTES_MAX) },
  };
}

/**
 * Validate the `severity` / `type` filters for the anomalies endpoint.
 * Empty or "all" means "no filter"; anything outside the whitelist is a 400 —
 * silently ignoring a typo would show the operator the wrong set of signals.
 */
export function parseAnomalyFilters(query = {}) {
  const errors = [];
  const rawSeverity = str(query.severity).toLowerCase();
  const rawType = str(query.type).toLowerCase();

  let severity = "";
  if (rawSeverity && rawSeverity !== "all") {
    if (!ANOMALY_SEVERITIES.includes(rawSeverity)) {
      errors.push(`severity must be one of ${ANOMALY_SEVERITIES.join(", ")}`);
    } else {
      severity = rawSeverity;
    }
  }

  let type = "";
  if (rawType && rawType !== "all") {
    if (!ANOMALY_TYPES.includes(rawType)) {
      errors.push(`type must be one of ${ANOMALY_TYPES.join(", ")}`);
    } else {
      type = rawType;
    }
  }

  return { ok: errors.length === 0, errors, severity, type };
}

/**
 * Basic hostname/domain syntax for the optional IP-label hostname field.
 * Accepts a bare hostname ("nas.local") or a FQDN ("server.example.com");
 * rejects scheme, path, port and whitespace — this is an annotation field,
 * not a URL collector.
 */
export function isValidHostname(value) {
  const host = str(value);
  if (host === "" || host.length > IP_LABEL_HOSTNAME_MAX) return false;
  if (/[\s/:?#@]/.test(host)) return false;
  const labels = host.split(".");
  if (labels.length < 1 || labels.length > 4) return false;
  return labels.every(
    (label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

/** Validate a create request for an IP Identity Manager label. */
export function validateIpLabelInput(body = {}) {
  const errors = [];
  const ip = str(body.ip);
  if (!isValidIp(ip)) errors.push("ip must be a valid IPv4 or IPv6 address");

  const displayName = str(body.displayName);
  if (!displayName) errors.push("displayName is required");
  else if (displayName.length > IP_LABEL_NAME_MAX) {
    errors.push(`displayName must be ${IP_LABEL_NAME_MAX} characters or fewer`);
  }

  const category = str(body.category);
  if (!category) errors.push("category is required");
  else if (!IP_LABEL_CATEGORIES.includes(category)) {
    errors.push(`category must be one of ${IP_LABEL_CATEGORIES.join(", ")}`);
  }

  const hostname = str(body.hostname);
  if (hostname && !isValidHostname(hostname)) {
    errors.push("hostname must be a valid hostname or domain (no scheme, path or port)");
  } else if (hostname.length > IP_LABEL_HOSTNAME_MAX) {
    errors.push(`hostname must be ${IP_LABEL_HOSTNAME_MAX} characters or fewer`);
  }

  if (str(body.note).length > IP_LABEL_NOTE_MAX) {
    errors.push(`note must be ${IP_LABEL_NOTE_MAX} characters or fewer`);
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      ip,
      displayName: sanitizeText(body.displayName, IP_LABEL_NAME_MAX),
      category: sanitizeText(body.category, 40),
      hostname: sanitizeText(body.hostname, IP_LABEL_HOSTNAME_MAX),
      note: sanitizeText(body.note, IP_LABEL_NOTE_MAX),
    },
  };
}

/** Validate a partial update; only provided fields are touched. */
export function validateIpLabelUpdate(body = {}) {
  const errors = [];
  const value = {};

  if (body.ip !== undefined) {
    const ip = str(body.ip);
    if (!isValidIp(ip)) errors.push("ip must be a valid IPv4 or IPv6 address");
    else value.ip = ip;
  }
  if (body.displayName !== undefined) {
    const name = str(body.displayName);
    if (!name) errors.push("displayName is required");
    else if (name.length > IP_LABEL_NAME_MAX) {
      errors.push(`displayName must be ${IP_LABEL_NAME_MAX} characters or fewer`);
    } else value.displayName = sanitizeText(body.displayName, IP_LABEL_NAME_MAX);
  }
  if (body.category !== undefined) {
    const category = str(body.category);
    if (!category) errors.push("category is required");
    else if (!IP_LABEL_CATEGORIES.includes(category)) {
      errors.push(`category must be one of ${IP_LABEL_CATEGORIES.join(", ")}`);
    } else value.category = sanitizeText(body.category, 40);
  }
  if (body.hostname !== undefined) {
    const host = str(body.hostname);
    if (host && !isValidHostname(host)) {
      errors.push("hostname must be a valid hostname or domain (no scheme, path or port)");
    } else value.hostname = sanitizeText(body.hostname, IP_LABEL_HOSTNAME_MAX);
  }
  if (body.note !== undefined) {
    if (str(body.note).length > IP_LABEL_NOTE_MAX) {
      errors.push(`note must be ${IP_LABEL_NOTE_MAX} characters or fewer`);
    } else value.note = sanitizeText(body.note, IP_LABEL_NOTE_MAX);
  }

  if (errors.length === 0 && Object.keys(value).length === 0) {
    errors.push("provide at least one field to update");
  }

  return { ok: errors.length === 0, errors, value };
}

/** Validate a MongoDB ObjectId path param without pulling in Mongoose. */
export function isValidObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value ?? ""));
}

/** Stable, URL-safe key for a persisted review record. */
export function anomalyKey(type, parts = []) {
  return [type, ...parts]
    .map((p) => String(p ?? "").replace(/[^a-zA-Z0-9_.:-]/g, "_"))
    .join(":")
    .slice(0, 160);
}

/** `{ from, to }` as `YYYY-MM-DD` (UTC) for a named preset. */
export function parseDateRangePreset(preset, now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (str(preset)) {
    case "24h":
      start.setUTCHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case "90d":
      start.setUTCDate(start.getUTCDate() - 89);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case "30d":
    default:
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);
  }

  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

/**
 * Fill every bucket between `from` and `to` (UTC) so charts never show gaps
 * for days with no traffic — zero means "no data recorded", never invented data.
 */
export function zeroFillSeries(buckets, from, to, granularity = "day") {
  const map = new Map((buckets || []).map((b) => [b.key, b]));
  const out = [];
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(to).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return buckets || [];
  }

  const stepMs = granularity === "hour" ? 3600000 : 86400000;
  const cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 5000) {
    const key = granularity === "hour"
      ? `${cursor.toISOString().slice(0, 13)}:00:00.000Z`
      : cursor.toISOString().slice(0, 10);
    out.push(map.get(key) || { key, pageViews: 0, sessions: 0, uniqueIps: 0 });
    cursor.setTime(cursor.getTime() + stepMs);
    guard += 1;
  }
  return out;
}
