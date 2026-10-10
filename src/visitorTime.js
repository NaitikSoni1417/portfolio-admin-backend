/**
 * Timezone-aware day maths for the Global Traffic analytics endpoint.
 *
 * Everything here is pure and dependency-free: IANA offsets are resolved with
 * `Intl`, which Node ships with full ICU data for. Day boundaries are always
 * computed in the *requested* timezone so "today" means the admin's today, not
 * the server's.
 */

const DAY_MS = 86400000;

export const DEFAULT_TIMEZONE = "UTC";
export const MAX_TIMEZONE_LENGTH = 64;

/** Longest range the analytics aggregation will accept — keeps a single request cheap. */
export const MAX_ANALYTICS_RANGE_DAYS = 366;

export const ANALYTICS_PRESETS = ["24h", "7d", "30d", "90d"];

/** `true` when the runtime can resolve this IANA zone. */
export function isValidTimezone(timezone) {
  if (typeof timezone !== "string") return false;
  const value = timezone.trim();
  if (!value || value.length > MAX_TIMEZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function offsetMs(utcMs, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const bag = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }

  // Some engines render midnight as hour "24" under hour12:false.
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour) % 24,
    Number(bag.minute),
    Number(bag.second)
  );
  return asUtc - utcMs;
}

function addDaysISO(dayISO, days) {
  const [y, m, d] = String(dayISO).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Instant of local midnight for `YYYY-MM-DD` in `timezone`. */
export function zonedDayStart(dayISO, timezone) {
  const [y, m, d] = String(dayISO).split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Two passes so a DST transition on the boundary still lands on local midnight.
  const first = guess - offsetMs(guess, timezone);
  return new Date(guess - offsetMs(first, timezone));
}

/** Last millisecond of the local day `YYYY-MM-DD` in `timezone`. */
export function zonedDayEnd(dayISO, timezone) {
  return new Date(zonedDayStart(addDaysISO(dayISO, 1), timezone).getTime() - 1);
}

/** Local calendar day (`YYYY-MM-DD`) of an instant, in `timezone`. */
export function zonedDayOf(instant, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** Local hour (0–23) of an instant, in `timezone`. */
export function zonedHourOf(instant, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
  }).formatToParts(new Date(instant));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(hour) % 24;
}

function dayToUtcMs(dayISO) {
  const [y, m, d] = String(dayISO).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole local days in `[from, to]` (Date instants), inclusive — at least 1. */
export function daysBetween(from, to, timezone = DEFAULT_TIMEZONE) {
  const start = dayToUtcMs(zonedDayOf(from, timezone));
  const end = dayToUtcMs(zonedDayOf(to, timezone));
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

/** `{ from, to }` as `YYYY-MM-DD` (in `timezone`) for a named preset ending today. */
export function presetBounds(preset, timezone, now = new Date()) {
  const today = zonedDayOf(now, timezone);
  const span = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[String(preset)] ?? 30;
  return { from: addDaysISO(today, -(span - 1)), to: today };
}

/** The equal-length window immediately before `from`, for "% vs previous" deltas. */
export function previousRange(from, to, timezone) {
  const days = daysBetween(zonedDayStart(from, timezone), zonedDayEnd(to, timezone));
  return {
    from: addDaysISO(from, -days),
    to: addDaysISO(from, -1),
    days,
  };
}

/** Hour for long ranges, day for short ones. */
export function pickGranularity(days) {
  return Number(days) <= 3 ? "hour" : "day";
}

/** `Sep 11 – Oct 10, 2026` — the range label the tab renders. */
export function formatAnalyticsLabel(from, to, timezone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
  const fmtYear = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(zonedDayStart(from, timezone))} – ${fmtYear.format(zonedDayStart(to, timezone))}`;
}

const HOUR_MS = 3600000;

function pad2(value) {
  return String(value).padStart(2, "0");
}

/** Local calendar parts of an instant, in `timezone`. */
export function localParts(instant, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(instant));

  const bag = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    day: `${bag.year}-${bag.month}-${bag.day}`,
    hour: Number(bag.hour) % 24,
  };
}

/** Bucket key for a local hour — matches MongoDB's `$hour` + `$dateToString`. */
export function hourBucketKey(instant, timezone) {
  const { day, hour } = localParts(instant, timezone);
  return `${day}T${pad2(hour)}:00:00.000Z`;
}

/**
 * Fill every local day (or local hour) in `[fromInstant, toInstant]` so a quiet
 * period renders as a flat zero line instead of a gap. Zero always means "no
 * recorded visits" — never invented data.
 */
export function zeroFillAnalytics(buckets, fromInstant, toInstant, granularity, timezone) {
  const map = new Map((buckets || []).map((b) => [b.key, b]));
  const startMs = fromInstant.getTime();
  const endMs = toInstant.getTime();
  const empty = (key) => ({ key, pageViews: 0, sessions: 0, uniqueIps: 0 });

  if (granularity === "hour") {
    // Walk hour-aligned instants; DST shifts can fold two instants into one
    // local hour, so keys are merged rather than duplicated on the chart.
    const ordered = new Map();
    const first = Math.floor(startMs / HOUR_MS) * HOUR_MS;
    let guard = 0;
    for (let t = first; t <= endMs && guard < 5000; t += HOUR_MS, guard += 1) {
      if (t < startMs) continue;
      const key = hourBucketKey(t, timezone);
      if (!ordered.has(key)) ordered.set(key, map.get(key) || empty(key));
    }
    return [...ordered.values()];
  }

  const out = [];
  let day = zonedDayOf(startMs, timezone);
  const lastDay = zonedDayOf(endMs, timezone);
  let guard = 0;
  while (day <= lastDay && guard < 2000) {
    out.push(map.get(day) || empty(day));
    day = addDaysISO(day, 1);
    guard += 1;
  }
  return out;
}

export { addDaysISO };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value) {
  const text = String(value);
  if (!DAY_RE.test(text)) return null;
  const ms = Date.parse(`${text}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  // Rejects 2026-02-31 and friends — Date.parse silently rolls those over.
  return new Date(ms).toISOString().slice(0, 10) === text ? text : null;
}

/**
 * Validate an analytics request's range, timezone and granularity.
 * `startDate`/`endDate` (or `from`/`to`) name a calendar day in `timezone`;
 * `preset` names a rolling window that ends on the admin's today.
 *
 * Returns `{ ok, errors, timezone, from, to, fromInstant, toInstant, days,
 * granularity, preset, previous }` — instants are inclusive boundaries.
 */
export function resolveAnalyticsRange(query = {}, { now = new Date() } = {}) {
  const errors = [];

  const rawTimezone = String(query.timezone ?? DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  const timezone = isValidTimezone(rawTimezone) ? rawTimezone : null;
  if (!timezone) {
    errors.push(`timezone must be a valid IANA zone name, got "${rawTimezone.slice(0, 40)}"`);
  }
  const tz = timezone || DEFAULT_TIMEZONE;

  const rawFrom = String(query.startDate ?? query.from ?? "").trim();
  const rawTo = String(query.endDate ?? query.to ?? "").trim();
  const rawPreset = String(query.preset ?? "").trim();

  let from = null;
  let to = null;
  let preset = "custom";

  if (rawFrom || rawTo) {
    if (rawPreset) errors.push("pass either preset or startDate/endDate, not both");
    if (!rawFrom) errors.push("startDate is required when endDate is provided");
    if (!rawTo) errors.push("endDate is required when startDate is provided");

    const parsedFrom = rawFrom ? parseDay(rawFrom) : null;
    const parsedTo = rawTo ? parseDay(rawTo) : null;
    if (rawFrom && !parsedFrom) errors.push(`startDate must be a YYYY-MM-DD calendar date, got "${rawFrom.slice(0, 40)}"`);
    if (rawTo && !parsedTo) errors.push(`endDate must be a YYYY-MM-DD calendar date, got "${rawTo.slice(0, 40)}"`);

    from = parsedFrom;
    to = parsedTo;
  } else {
    const name = rawPreset || "30d";
    if (!ANALYTICS_PRESETS.includes(name)) {
      errors.push(`preset must be one of ${ANALYTICS_PRESETS.join(", ")}, got "${name.slice(0, 40)}"`);
    } else {
      const bounds = presetBounds(name, tz, now);
      from = bounds.from;
      to = bounds.to;
      preset = name;
    }
  }

  let fromInstant = null;
  let toInstant = null;
  let days = 0;
  let previous = null;

  if (from && to) {
    if (from > to) {
      errors.push("startDate must be earlier than or equal to endDate");
    } else {
      fromInstant = zonedDayStart(from, tz);
      toInstant = zonedDayEnd(to, tz);
      days = daysBetween(fromInstant, toInstant, tz);

      if (days > MAX_ANALYTICS_RANGE_DAYS) {
        errors.push(
          `the requested range spans ${days} days; the maximum is ${MAX_ANALYTICS_RANGE_DAYS}`
        );
      } else {
        previous = previousRange(from, to, tz);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const rawGranularity = String(query.granularity ?? "").trim().toLowerCase();
  let granularity;
  if (rawGranularity === "day" || rawGranularity === "hour") {
    granularity = rawGranularity;
  } else if (rawGranularity === "") {
    granularity = pickGranularity(days);
  } else {
    return { ok: false, errors: ["granularity must be day or hour"] };
  }

  return {
    ok: true,
    errors: [],
    timezone: tz,
    from,
    to,
    fromInstant,
    toInstant,
    days,
    granularity,
    preset,
    previous,
  };
}

