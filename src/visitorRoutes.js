import { Router } from "express";
import {
  PAGE_SIZES,
  EXPORT_ROW_CAP,
  buildVisitorFilter,
  buildVisitorSort,
  parsePagination,
  parseDateRangePreset,
  formatRangeLabel,
  totalPagesFor,
  toCsv,
  validateBookmarkInput,
  validateBookmarkUpdate,
  validateReviewInput,
  anomalyKey,
  isValidIp,
  normalizeIp,
  zeroFillSeries,
  facetLabel,
  normalizeDeviceLabel,
  normalizeOsLabel,
  normalizeBrowserLabel,
} from "./visitorQuery.js";
import { mergeFacetBy, mergeReferrerSources } from "./visitorReferrer.js";
import {
  formatAnalyticsLabel,
  resolveAnalyticsRange,
  zonedDayEnd,
  zonedDayStart,
  zeroFillAnalytics,
} from "./visitorTime.js";

/**
 * Repeat-query threshold for the anomaly view. Deliberately high enough that
 * normal browsing never trips it — these are *signals to review*, not verdicts.
 */
const REPEAT_IP_MIN_VIEWS = 40;
const ANOMALY_CAP = 60;

/** Facet rows the analytics view returns before the rest is folded into "Others". */
const COUNTRY_TOP = 8;
const SMALL_FACET_TOP = 6;
/** Upper bound on a facet group query — a guard, not a page size. */
const FACET_SCAN_LIMIT = 2000;

/**
 * Explicit, display-ready definitions of every headline number. The analytics
 * view must never leave a metric's meaning up to the reader's guesswork.
 */
const METRIC_DEFINITIONS = {
  pageViews: "One stored visit record. A single page load that was recorded once counts as one.",
  sessions:
    "Distinct sessions in the range. Records without a sessionId are counted as their own session.",
  uniqueIps:
    "Distinct visitor identities in the range — the visitorId when one was recorded, otherwise the IP address.",
  newIps: "Identities whose first recorded visit falls inside the selected range.",
  returningIps: "Identities with more than one recorded visit inside the selected range.",
};

const DISCLAIMER =
  "Pattern-based signal computed from stored telemetry. It is not a verdict that a person, " +
  "IP address or country is malicious — shared and carrier NAT addresses routinely group " +
  "unrelated people. Review the evidence before acting.";

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

/**
 * Page sizes the visit-history side panel may ask for. Deliberately smaller
 * than the main table ladder — a detail drawer only needs a handful of rows.
 */
const HISTORY_PAGE_SIZES = [10, 25, 50];
const HISTORY_DEFAULT_LIMIT = 10;

function plainQuery(req) {
  const out = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) return { error: `duplicate query parameter: ${key}` };
    out[key] = value;
  }
  return { query: out };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** `{ _id, count }` rows → `{ key, count, share }`, share as a percentage of `total`. */
function withShare(rows = [], total = 0) {
  const base = Number(total) > 0 ? Number(total) : 0;
  return (rows || []).map((row) => ({
    key: facetLabel(row?._id),
    count: Number(row?.count) || 0,
    share: base > 0 ? round1(((Number(row?.count) || 0) / base) * 100) : 0,
  }));
}

/**
 * Keep the top `top` rows and fold the remainder into a single "Others" row so
 * a long tail never turns into an unreadable list.
 */
function splitOthers(items = [], top = SMALL_FACET_TOP) {
  const head = items.slice(0, top);
  const rest = items.slice(top);
  const restCount = rest.reduce((sum, row) => sum + row.count, 0);
  return { head, others: restCount > 0 ? { key: "Others", count: restCount, rest: rest.length } : null };
}

/** Percent change vs the previous window, or `null` when there is nothing to divide by. */
function deltaPct(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
  return round1(((c - p) / p) * 100);
}

/**
 * Canonical bookmark key for an address.
 * Falls back to the raw string when the value is not a valid IP so a malformed
 * visitor record still renders instead of silently vanishing from the set.
 */
function bookmarkKey(ip) {
  return normalizeIp(ip) || String(ip ?? "");
}

/** Resolve `:ip` from the path to its canonical form, or report a 400. */
function parseIpParam(raw) {
  const ip = String(raw ?? "");
  if (!isValidIp(ip)) return { ok: false, errors: ["ip must be a valid IPv4 or IPv6 address"] };
  return { ok: true, ip: normalizeIp(ip) };
}

function isoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resolveRange(query) {
  const hasExplicit = Boolean(query.from || query.to);
  const effective = { ...query };

  if (!hasExplicit) {
    const preset = parseDateRangePreset(query.preset || "30d");
    effective.from = preset.from;
    effective.to = preset.to;
  }

  const built = buildVisitorFilter(effective);
  if (!built.ok) return { ok: false, errors: built.errors };

  const cond = built.filter.createdAt || {};
  const from = cond.$gte || null;
  const to = cond.$lte || null;

  const rawGranularity = String(query.granularity || "").toLowerCase();
  let granularity;
  if (rawGranularity === "hour" || rawGranularity === "day") {
    granularity = rawGranularity;
  } else if (rawGranularity === "") {
    granularity = !hasExplicit && String(query.preset || "") === "24h" ? "hour" : "day";
  } else {
    return { ok: false, errors: ["granularity must be day or hour"] };
  }

  if (!from || !to) return { ok: false, errors: ["a valid date range is required"] };

  return {
    ok: true,
    filter: built.filter,
    from,
    to,
    granularity,
    preset: hasExplicit ? "custom" : String(query.preset || "30d"),
    errors: [],
  };
}

function buildAnomalies({ hourly, repeat, failedLogins, blocked, reviews, from, to }) {
  const reviewMap = new Map((reviews || []).map((r) => [r.key, r]));
  const items = [];

  const decorate = (raw) => {
    const review = reviewMap.get(raw.key);
    return {
      ...raw,
      status: review?.status || "open",
      notes: review?.notes || "",
      updatedAt: isoOrNull(review?.updatedAt),
      disclaimer: DISCLAIMER,
    };
  };

  // ── 1. Traffic spike ───────────────────────────────────────────────────────
  const buckets = hourly || [];
  if (buckets.length >= 6) {
    const values = buckets.map((b) => b.views);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    const threshold = Math.max(10, mean + 3 * std);

    if (mean > 0) {
      for (const bucket of buckets) {
        const multiplier = bucket.views / mean;
        if (bucket.views < threshold || multiplier < 2) continue;
        items.push(
          decorate({
            key: anomalyKey("traffic_spike", [bucket.key]),
            type: "traffic_spike",
            severity: multiplier >= 5 ? "high" : multiplier >= 3 ? "medium" : "low",
            title: "Unusual traffic volume in one hour",
            summary:
              `${bucket.views} page views were recorded in the hour starting ${bucket.key} ` +
              `against a baseline of ${round1(mean)} per hour (${round1(multiplier)}× baseline).`,
            at: bucket.key,
            evidence: {
              hourStart: bucket.key,
              pageViews: bucket.views,
              baselineMeanPerHour: round1(mean),
              baselineStdDev: round1(std),
              multiplier: round1(multiplier),
              threshold: round1(threshold),
              bucketCount: buckets.length,
            },
          })
        );
      }
    }
  }

  // ── 2. High-volume network endpoint ───────────────────────────────────────
  for (const row of repeat || []) {
    const severity = row.views >= 200 ? "high" : row.views >= 100 ? "medium" : "low";
    items.push(
      decorate({
        key: anomalyKey("high_volume_endpoint", [row.ip]),
        type: "high_volume_endpoint",
        severity,
        title: "High request volume from a single network endpoint",
        summary:
          `${row.ip} produced ${row.views} page views across ${row.sessions} session(s) ` +
          `and ${row.pages.length} distinct page(s) inside the selected window.`,
        at: isoOrNull(row.lastSeen),
        evidence: {
          ip: row.ip,
          pageViews: row.views,
          sessions: row.sessions,
          distinctPages: row.pages.length,
          topPages: row.pages.slice(0, 6),
          country: row.country,
          city: row.city,
          device: row.device,
          firstSeen: isoOrNull(row.firstSeen),
          lastSeen: isoOrNull(row.lastSeen),
          window: { from: isoOrNull(from), to: isoOrNull(to) },
        },
      })
    );
  }

  // ── 3. Repeated failed admin logins (persisted security telemetry) ────────
  for (const row of failedLogins || []) {
    const severity = row.attempts >= 5 ? "high" : row.attempts >= 3 ? "medium" : "low";
    items.push(
      decorate({
        key: anomalyKey("failed_logins", [row.ip]),
        type: "failed_logins",
        severity,
        title: "Repeated failed admin login attempts",
        summary:
          `${row.attempts} failed admin login attempt(s) were recorded from ${row.ip}; ` +
          `most recent ${isoOrNull(row.lastAttempt) || "unknown"}.`,
        at: isoOrNull(row.lastAttempt),
        evidence: {
          ip: row.ip,
          attempts: row.attempts,
          lastAttempt: isoOrNull(row.lastAttempt),
          reason: row.reason,
          source: "SecurityLog.action=FAILED_LOGIN",
        },
      })
    );
  }

  // ── 4. Firewall trips (persisted) ─────────────────────────────────────────
  for (const row of blocked || []) {
    items.push(
      decorate({
        key: anomalyKey("firewall_block", [row.ip, isoOrNull(row.at) || ""]),
        type: "firewall_block",
        severity: "high",
        title: "Firewall blocked a request burst",
        summary:
          `The NS.ai SOC firewall blocked ${row.ip} after ${row.attempts} request(s) ` +
          `within one minute (${row.reason}).`,
        at: isoOrNull(row.at),
        evidence: {
          ip: row.ip,
          attempts: row.attempts,
          reason: row.reason,
          blockedUntil: isoOrNull(row.blockedUntil),
          source: "SecurityLog.action=AUTO_BLOCKED_TRAFFIC",
        },
      })
    );
  }

  return items
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return String(b.at || "").localeCompare(String(a.at || ""));
    })
    .slice(0, ANOMALY_CAP);
}

export function createVisitorRouter({ auth, repo }) {
  const router = Router();

  const loadBookmarks = async () => {
    const rows = await repo.bookmarks.all();
    return new Set(rows.map((b) => bookmarkKey(b.ip)));
  };

  // ── GET /api/admin/visitors — paginated, filtered, stable-sorted ──────────
  router.get("/", auth, async (req, res) => {
    try {
      const parsed = plainQuery(req);
      if (parsed.error) return res.status(400).json({ ok: false, errors: [parsed.error] });

      const pagination = parsePagination(parsed.query);
      const filterResult = buildVisitorFilter(parsed.query);
      const sortResult = buildVisitorSort(parsed.query);
      const errors = [...pagination.errors, ...filterResult.errors, ...sortResult.errors];
      if (errors.length) return res.status(400).json({ ok: false, errors });

      // Fetch once; if the caller asked for a page past the end, fall back to
      // the last real page instead of handing back an empty, mislabelled range.
      let page = pagination.page;
      let skip = pagination.skip;
      let listResult = await repo.list({
        filter: filterResult.filter,
        sort: sortResult.sort,
        skip,
        limit: pagination.limit,
      });
      let total = listResult.total;
      let items = listResult.items;

      const totalPages = totalPagesFor(total, pagination.limit);
      if (page > totalPages) {
        page = totalPages;
        skip = (page - 1) * pagination.limit;
        listResult = await repo.list({
          filter: filterResult.filter,
          sort: sortResult.sort,
          skip,
          limit: pagination.limit,
        });
        total = listResult.total;
        items = listResult.items;
      }

      const ips = [...new Set(items.map((v) => v.ip).filter(Boolean))];
      const [stats, bookmarkSet] = await Promise.all([repo.visitStats({ ips }), loadBookmarks()]);
      const visitMap = new Map(stats.map((s) => [s.ip, s.visits]));

      const enriched = items.map((v) => {
        const visits = visitMap.get(v.ip) || 1;
        return {
          ...v,
          visits,
          isReturning: visits > 1,
          bookmarked: bookmarkSet.has(bookmarkKey(v.ip)),
        };
      });

      res.json({
        ok: true,
        items: enriched,
        total,
        page,
        limit: pagination.limit,
        totalPages,
        range: formatRangeLabel(total, page, pagination.limit),
        sort: `${sortResult.field}:${sortResult.direction === 1 ? "asc" : "desc"}`,
        pageSizes: PAGE_SIZES,
      });
    } catch (err) {
      console.error("visitors.list error:", err.message);
      res.status(500).json({ ok: false, error: "Failed to load visitors" });
    }
  });

  // ── GET /api/admin/visitors/export.csv — every matching row, not the page ─
  router.get("/export.csv", auth, async (req, res) => {
    try {
      const parsed = plainQuery(req);
      if (parsed.error) return res.status(400).json({ ok: false, errors: [parsed.error] });

      const filterResult = buildVisitorFilter(parsed.query);
      const sortResult = buildVisitorSort(parsed.query);
      const errors = [...filterResult.errors, ...sortResult.errors];
      if (errors.length) return res.status(400).json({ ok: false, errors });

      const docs = await repo.exportAll({
        filter: filterResult.filter,
        sort: sortResult.sort,
        cap: EXPORT_ROW_CAP,
      });
      const truncated = docs.length >= EXPORT_ROW_CAP;

      const ips = [...new Set(docs.map((v) => v.ip).filter(Boolean))];
      const [stats, bookmarkSet] = await Promise.all([
        ips.length <= 5000 ? repo.visitStats({ ips }) : Promise.resolve([]),
        loadBookmarks(),
      ]);
      const visitMap = new Map(stats.map((s) => [s.ip, s.visits]));

      const headers = [
        "IP",
        "City",
        "Region",
        "Country",
        "ISP",
        "Browser",
        "OS",
        "Device",
        "Page",
        "Referrer",
        "Session ID",
        "Screen",
        "Language",
        "Timezone",
        "Visits",
        "Returning",
        "Bookmarked",
        "Visited At",
      ];

      const rows = docs.map((v) => {
        const visits = visitMap.get(v.ip);
        return [
          v.ip,
          v.city,
          v.region,
          v.country,
          v.isp,
          v.browser,
          v.os,
          v.device,
          v.page,
          v.referrer,
          v.sessionId,
          v.screen,
          v.language,
          v.timezone,
          visits === undefined ? "" : visits,
          visits !== undefined && visits > 1 ? "Yes" : "No",
          bookmarkSet.has(bookmarkKey(v.ip)) ? "Yes" : "No",
          isoOrNull(v.createdAt),
        ];
      });

      const csv = toCsv(rows, headers);
      const stamp = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="ns-visitors-${stamp}.csv"`);
      res.setHeader("X-Export-Row-Count", String(rows.length));
      res.setHeader("X-Export-Truncated", String(truncated));
      res.send(csv);
    } catch (err) {
      console.error("visitors.export error:", err.message);
      res.status(500).json({ ok: false, error: "Export failed" });
    }
  });

  // ── GET /api/admin/visitors/analytics — global traffic ────────────────────
  //
  // Aggregates the *whole* visitor collection for the requested window — not a
  // page of loaded rows. Never returns raw IP addresses: every breakdown is a
  // count grouped by a non-identifying dimension.
  router.get("/analytics", auth, async (req, res) => {
    try {
      const parsed = plainQuery(req);
      if (parsed.error) return res.status(400).json({ ok: false, errors: [parsed.error] });

      const range = resolveAnalyticsRange(parsed.query);
      if (!range.ok) return res.status(400).json({ ok: false, errors: range.errors });

      // Range is resolved timezone-aware above, so strip the date keys before
      // the generic filter builder — it would re-parse them as UTC.
      const filterQuery = { ...parsed.query };
      for (const key of ["from", "to", "startDate", "endDate", "preset", "timezone", "granularity"]) {
        delete filterQuery[key];
      }
      const built = buildVisitorFilter(filterQuery);
      if (!built.ok) return res.status(400).json({ ok: false, errors: built.errors });

      const filter = { ...built.filter, createdAt: { $gte: range.fromInstant, $lte: range.toInstant } };
      const previous = range.previous;
      const previousFilter = previous
        ? {
            ...built.filter,
            createdAt: {
              $gte: zonedDayStart(previous.from, range.timezone),
              $lte: zonedDayEnd(previous.to, range.timezone),
            },
          }
        : null;

      const [
        metrics,
        previousMetrics,
        buckets,
        hourBuckets,
        countryRows,
        deviceRows,
        browserRows,
        osRows,
        referrerRows,
        pageRows,
        ispRows,
      ] = await Promise.all([
        repo.metrics({ filter }),
        previousFilter ? repo.metrics({ filter: previousFilter }) : Promise.resolve(null),
        repo.series({ filter, granularity: range.granularity, timezone: range.timezone }),
        repo.hourBreakdown({ filter, timezone: range.timezone }),
        repo.facet({ filter, field: "country", limit: FACET_SCAN_LIMIT }),
        repo.facet({ filter, field: "device", limit: 20 }),
        // Browsers are folded to families, so the raw scan has to reach past
        // every version string (Chrome 148…151, Mobile Chrome 151…) to see
        // the less common families underneath them.
        repo.facet({ filter, field: "browser", limit: 500 }),
        repo.facet({ filter, field: "os", limit: 20 }),
        // Referrers are merged into sources client-side by this route, so the
        // raw scan has to reach past the top 8 URLs to see every variant.
        repo.facet({ filter, field: "referrer", limit: 500 }),
        repo.facet({ filter, field: "page", limit: 100 }),
        repo.facet({ filter, field: "isp", limit: 50 }),
      ]);

      const totalRows = metrics.pageViews;

      const totals = {
        pageViews: metrics.pageViews,
        sessions: metrics.sessions,
        uniqueIps: metrics.uniqueIps,
        // "New" and "returning" are both defined *inside the selected range* so
        // the split always adds up to `uniqueIps` with no cross-range guesswork.
        newIps: Math.max(0, metrics.uniqueIps - metrics.returningIps),
        returningIps: metrics.returningIps,
        countries: countryRows.length,
      };

      let previousTotals = null;
      let deltas = null;
      if (previousMetrics) {
        previousTotals = {
          pageViews: previousMetrics.pageViews,
          sessions: previousMetrics.sessions,
          uniqueIps: previousMetrics.uniqueIps,
        };
        deltas = {
          pageViews: deltaPct(totals.pageViews, previousMetrics.pageViews),
          sessions: deltaPct(totals.sessions, previousMetrics.sessions),
          uniqueIps: deltaPct(totals.uniqueIps, previousMetrics.uniqueIps),
        };
      }

      const countryItems = withShare(countryRows, totalRows);
      const countrySplit = splitOthers(countryItems, COUNTRY_TOP);

      // Zero-filled in the requested timezone so a quiet local day reads as a
      // flat zero instead of a hole in the chart.
      const series = zeroFillAnalytics(
        buckets,
        range.fromInstant,
        range.toInstant,
        range.granularity,
        range.timezone
      );

      // Collapsed to 24 local hours across the whole range — "traffic by hour
      // of day", independent of how long the selected window is.
      const hourly = Array.from({ length: 24 }, (_, hour) => {
        const found = hourBuckets.find((row) => row.hour === hour);
        return {
          hour,
          pageViews: found?.pageViews ?? 0,
          sessions: found?.sessions ?? 0,
          uniqueIps: found?.uniqueIps ?? 0,
        };
      });

      res.json({
        ok: true,
        range: {
          from: range.from,
          to: range.to,
          label: formatAnalyticsLabel(range.from, range.to, range.timezone),
          timezone: range.timezone,
          granularity: range.granularity,
          preset: range.preset,
          days: range.days,
        },
        totals,
        previous: previousTotals
          ? {
              ...previousTotals,
              from: previous.from,
              to: previous.to,
              days: previous.days,
            }
          : null,
        deltas,
        series,
        hourly,
        countries: { total: countryRows.length, items: countrySplit.head, others: countrySplit.others },
        // Device and OS are folded to canonical labels first so `Mobile` and
        // `mobile` stop showing up as two separate rows.
        devices: mergeFacetBy(deviceRows, normalizeDeviceLabel, totalRows, 8),
        browsers: mergeFacetBy(browserRows, normalizeBrowserLabel, totalRows, 8),
        operatingSystems: mergeFacetBy(osRows, normalizeOsLabel, totalRows, 8),
        referrers: mergeReferrerSources(referrerRows, totalRows, 8),
        pages: withShare(pageRows, totalRows).slice(0, 8),
        isps: withShare(ispRows, totalRows).slice(0, 8),
        meta: {
          generatedAt: new Date().toISOString(),
          timezone: range.timezone,
          granularity: range.granularity,
          days: range.days,
          previousRange: previous ? { from: previous.from, to: previous.to, days: previous.days } : null,
          definitions: METRIC_DEFINITIONS,
        },
      });
    } catch (err) {
      console.error("visitors.analytics error:", err.message);
      res.status(500).json({ ok: false, error: "Analytics failed" });
    }
  });

  // ── GET /api/admin/visitors/bookmarks ─────────────────────────────────────
  router.get("/bookmarks", auth, async (req, res) => {
    try {
      const parsed = plainQuery(req);
      if (parsed.error) return res.status(400).json({ ok: false, errors: [parsed.error] });

      const pagination = parsePagination(parsed.query);
      if (!pagination.ok) return res.status(400).json({ ok: false, errors: pagination.errors });

      const rawQuery = String(parsed.query.q ?? parsed.query.search ?? "").trim();
      if (rawQuery.length > 120) {
        return res.status(400).json({ ok: false, errors: ["search query is too long"] });
      }
      const needle = rawQuery.toLowerCase();
      const countryFilter = String(parsed.query.country ?? "").trim().toLowerCase();

      const bookmarks = await repo.bookmarks.all();
      const stats = await repo.bookmarkStats({ ips: bookmarks.map((b) => b.ip) });
      const statMap = new Map(stats.map((s) => [bookmarkKey(s.ip), s]));

      let joined = bookmarks.map((b) => {
        const s = statMap.get(bookmarkKey(b.ip)) || {};
        return {
          ip: b.ip,
          label: b.label || "",
          notes: b.notes || "",
          createdAt: isoOrNull(b.createdAt),
          updatedAt: isoOrNull(b.updatedAt),
          visits: s.visits || 0,
          firstSeen: isoOrNull(s.firstSeen),
          lastSeen: isoOrNull(s.lastSeen),
          country: s.country || "Unknown",
          countryCode: s.countryCode || "",
          city: s.city || "Unknown",
          region: s.region || "",
          device: s.device || "Unknown",
          browser: s.browser || "Unknown",
          os: s.os || "Unknown",
          page: s.page || "/",
          isp: s.isp || "",
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          countries: s.countries || [],
          pages: s.pages || [],
        };
      });

      if (needle) {
        joined = joined.filter((b) =>
          [b.ip, b.label, b.notes, b.country, b.city, b.device, b.browser, b.page, b.isp]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        );
      }
      if (countryFilter) {
        joined = joined.filter(
          (b) => b.country.toLowerCase() === countryFilter || b.countries.join(" ").toLowerCase().includes(countryFilter)
        );
      }

      joined.sort((a, b) => {
        const at = a.lastSeen || a.updatedAt || "";
        const bt = b.lastSeen || b.updatedAt || "";
        return String(bt).localeCompare(String(at));
      });

      // Same clamp as the visitor list: an out-of-range page resolves to the
      // last real page rather than returning an empty, mislabelled range.
      const total = joined.length;
      const totalPages = totalPagesFor(total, pagination.limit);
      const page = Math.min(pagination.page, totalPages);
      const start = (page - 1) * pagination.limit;
      const items = joined.slice(start, start + pagination.limit);

      res.json({
        ok: true,
        items,
        total,
        page,
        limit: pagination.limit,
        totalPages,
        range: formatRangeLabel(total, page, pagination.limit),
        pageSizes: PAGE_SIZES,
      });
    } catch (err) {
      console.error("visitors.bookmarks.list error:", err.message);
      res.status(500).json({ ok: false, error: "Failed to load bookmarks" });
    }
  });

  // ── POST /api/admin/visitors/bookmarks — create / update in one call ──────
  router.post("/bookmarks", auth, async (req, res) => {
    try {
      const result = validateBookmarkInput(req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

      const ip = normalizeIp(result.value.ip);
      const existing = await repo.bookmarks.get(ip);
      const bookmark = await repo.bookmarks.upsert({ ...result.value, ip });

      res.status(201).json({
        ok: true,
        bookmark,
        created: !existing,
        alreadyBookmarked: Boolean(existing),
      });
    } catch (err) {
      console.error("visitors.bookmarks.create error:", err.message);
      res.status(500).json({ ok: false, error: "Bookmark failed" });
    }
  });

  // ── GET /api/admin/visitors/bookmarks/:ip — one bookmark + live metadata ──
  router.get("/bookmarks/:ip", auth, async (req, res) => {
    try {
      const parsed = parseIpParam(req.params.ip);
      if (!parsed.ok) return res.status(400).json({ ok: false, errors: parsed.errors });

      const stored = await repo.bookmarks.get(parsed.ip);
      if (!stored) return res.status(404).json({ ok: false, error: "Bookmark not found" });

      const [stats] = await repo.bookmarkStats({ ips: [parsed.ip] });
      const s = stats || {};

      res.json({
        ok: true,
        bookmark: {
          ip: stored.ip,
          label: stored.label || "",
          notes: stored.notes || "",
          createdAt: isoOrNull(stored.createdAt),
          updatedAt: isoOrNull(stored.updatedAt),
          visits: s.visits || 0,
          firstSeen: isoOrNull(s.firstSeen),
          lastSeen: isoOrNull(s.lastSeen),
          country: s.country || "Unknown",
          countryCode: s.countryCode || "",
          city: s.city || "Unknown",
          region: s.region || "",
          device: s.device || "Unknown",
          browser: s.browser || "Unknown",
          os: s.os || "Unknown",
          page: s.page || "/",
          isp: s.isp || "",
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          countries: s.countries || [],
          pages: s.pages || [],
        },
      });
    } catch (err) {
      console.error("visitors.bookmarks.get error:", err.message);
      res.status(500).json({ ok: false, error: "Failed to load bookmark" });
    }
  });

  // ── GET /api/admin/visitors/bookmarks/:ip/history — real stored visits ────
  router.get("/bookmarks/:ip/history", auth, async (req, res) => {
    try {
      const parsed = parseIpParam(req.params.ip);
      if (!parsed.ok) return res.status(400).json({ ok: false, errors: parsed.errors });

      const stored = await repo.bookmarks.get(parsed.ip);
      if (!stored) return res.status(404).json({ ok: false, error: "Bookmark not found" });

      const pagination = parsePagination(req.query || {}, {
        pageSizes: HISTORY_PAGE_SIZES,
        defaultLimit: HISTORY_DEFAULT_LIMIT,
      });
      if (pagination.errors.length) return res.status(400).json({ ok: false, errors: pagination.errors });

      let page = pagination.page;
      let history = await repo.bookmarkHistory({
        ip: parsed.ip,
        skip: pagination.skip,
        limit: pagination.limit,
      });
      const totalPages = totalPagesFor(history.total, pagination.limit);

      if (page > totalPages) {
        page = totalPages;
        history = await repo.bookmarkHistory({
          ip: parsed.ip,
          skip: (page - 1) * pagination.limit,
          limit: pagination.limit,
        });
      }

      res.json({
        ok: true,
        ip: parsed.ip,
        items: history.items,
        total: history.total,
        page,
        limit: pagination.limit,
        totalPages,
        range: formatRangeLabel(history.total, page, pagination.limit),
        pageSizes: HISTORY_PAGE_SIZES,
      });
    } catch (err) {
      console.error("visitors.bookmarks.history error:", err.message);
      res.status(500).json({ ok: false, error: "Failed to load visit history" });
    }
  });

  // ── PATCH /api/admin/visitors/bookmarks/:ip — label / notes only ──────────
  router.patch("/bookmarks/:ip", auth, async (req, res) => {
    try {
      const parsed = parseIpParam(req.params.ip);
      if (!parsed.ok) return res.status(400).json({ ok: false, errors: parsed.errors });

      const result = validateBookmarkUpdate(req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

      const existing = await repo.bookmarks.get(parsed.ip);
      if (!existing) return res.status(404).json({ ok: false, error: "Bookmark not found" });

      const bookmark = await repo.bookmarks.update({ ip: parsed.ip, ...result.value });
      res.json({ ok: true, bookmark });
    } catch (err) {
      console.error("visitors.bookmarks.update error:", err.message);
      res.status(500).json({ ok: false, error: "Update failed" });
    }
  });

  // ── DELETE /api/admin/visitors/bookmarks/:ip — bookmark only, keep history ─
  router.delete("/bookmarks/:ip", auth, async (req, res) => {
    try {
      const parsed = parseIpParam(req.params.ip);
      if (!parsed.ok) return res.status(400).json({ ok: false, errors: parsed.errors });

      const removed = await repo.bookmarks.remove(parsed.ip);
      if (!removed) return res.status(404).json({ ok: false, error: "Bookmark not found" });

      res.json({ ok: true, removed: true, historyPreserved: true });
    } catch (err) {
      console.error("visitors.bookmarks.remove error:", err.message);
      res.status(500).json({ ok: false, error: "Remove failed" });
    }
  });

  // ── GET /api/admin/visitors/anomalies — explainable signals ───────────────
  router.get("/anomalies", auth, async (req, res) => {
    try {
      const parsed = plainQuery(req);
      if (parsed.error) return res.status(400).json({ ok: false, errors: [parsed.error] });

      const range = resolveRange(parsed.query);
      if (!range.ok) return res.status(400).json({ ok: false, errors: range.errors });

      const [hourly, repeat, failedLogins, blocked, reviews] = await Promise.all([
        repo.hourlyViews({ from: range.from, to: range.to }),
        repo.repeatIps({ filter: range.filter, min: REPEAT_IP_MIN_VIEWS, limit: 25 }),
        repo.failedLoginSignals({ from: range.from, to: range.to, limit: 20 }),
        repo.blockedTrafficSignals({ from: range.from, to: range.to, limit: 20 }),
        repo.reviews.all(),
      ]);

      const filled = zeroFillSeries(
        hourly.map((h) => ({ key: h.key, pageViews: h.views, sessions: 0, uniqueIps: 0 })),
        range.from.toISOString(),
        range.to.toISOString(),
        "hour"
      );

      const items = buildAnomalies({
        hourly: filled.map((b) => ({ key: b.key, views: b.pageViews })),
        repeat,
        failedLogins,
        blocked,
        reviews,
        from: range.from,
        to: range.to,
      });

      res.json({
        ok: true,
        items,
        total: items.length,
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          preset: range.preset,
          timezone: "UTC",
        },
        disclaimer: DISCLAIMER,
        thresholds: {
          repeatIpMinPageViews: REPEAT_IP_MIN_VIEWS,
          spikeRule: "hourly views ≥ max(10, mean + 3σ) and ≥ 2× mean",
          cap: ANOMALY_CAP,
        },
      });
    } catch (err) {
      console.error("visitors.anomalies error:", err.message);
      res.status(500).json({ ok: false, error: "Anomalies failed" });
    }
  });

  // ── PATCH /api/admin/visitors/anomalies/:key — review status + notes ──────
  router.patch("/anomalies/:key", auth, async (req, res) => {
    try {
      const key = String(req.params.key || "").slice(0, 160);
      if (!key) return res.status(400).json({ ok: false, errors: ["key is required"] });

      const result = validateReviewInput(req.body || {});
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

      const review = await repo.reviews.upsert({ key, ...result.value });
      res.json({ ok: true, review });
    } catch (err) {
      console.error("visitors.anomalies.review error:", err.message);
      res.status(500).json({ ok: false, error: "Review update failed" });
    }
  });

  return router;
}
