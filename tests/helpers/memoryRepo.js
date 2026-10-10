/**
 * In-memory implementation of the visitor repository contract.
 * Mirrors `src/visitorRepo.js` semantics so the API suite can assert real
 * pagination, filtering, totals, exports and mutations without a database.
 */

import { matchesFilter } from "./matchFilter.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uidOf(doc) {
  return doc.visitorId || doc.ip || "unknown";
}

function sidOf(doc) {
  return doc.sessionId ? String(doc.sessionId) : `anon:${doc._id}`;
}

function bucketOf(doc, granularity, timezone = "UTC") {
  const d = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
  if (timezone === "UTC") {
    if (granularity === "hour") {
      return `${d.toISOString().slice(0, 13)}:00:00.000Z`;
    }
    return d.toISOString().slice(0, 10);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const bag = {};
  for (const part of parts) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const day = `${bag.year}-${bag.month}-${bag.day}`;
  if (granularity === "hour") {
    return `${day}T${String(Number(bag.hour) % 24).padStart(2, "0")}:00:00.000Z`;
  }
  return day;
}

function compareValues(a, b) {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av === bv) return 0;
  if (av === undefined || av === null) return -1;
  if (bv === undefined || bv === null) return 1;
  return av < bv ? -1 : 1;
}

function sortDocs(docs, sort = {}) {
  const entries = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const cmp = compareValues(a[field], b[field]);
      if (cmp !== 0) return dir >= 0 ? cmp : -cmp;
    }
    return 0;
  });
}

function groupBy(docs, keyFn) {
  const map = new Map();
  for (const doc of docs) {
    const key = keyFn(doc);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(doc);
  }
  return map;
}

export function createMemoryRepo(seed = {}) {
  let seq = 0;
  const visitors = (seed.visitors || []).map((v, i) => ({
    _id: v._id || `visitor_${i + 1}`,
    sessionId: "",
    visitorId: "",
    ...v,
  }));
  const securityLogs = (seed.securityLogs || []).map((s, i) => ({
    _id: s._id || `log_${i + 1}`,
    ...s,
  }));
  const bookmarks = (seed.bookmarks || []).map((b) => ({ ...b }));
  const reviews = (seed.reviews || []).map((r) => ({ ...r }));

  const ensure = (list, patch) => Object.assign({ createdAt: new Date() }, list, patch);

  const repo = {
    async list({ filter, sort, skip, limit }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      const sorted = sortDocs(matched, sort);
      return {
        items: clone(sorted.slice(skip, skip + limit)),
        total: sorted.length,
      };
    },

    async exportAll({ filter, sort, cap }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      return clone(sortDocs(matched, sort).slice(0, cap));
    },

    async facet({ filter, field, limit }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      const counts = new Map();
      for (const doc of matched) {
        const raw = doc[field];
        const key = raw === undefined || raw === null || raw === "" ? "Unknown" : String(raw);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return [...counts.entries()]
        .map(([key, count]) => ({ _id: key, count }))
        .sort((a, b) => b.count - a.count || String(a._id).localeCompare(String(b._id)))
        .slice(0, limit);
    },

    async metrics({ filter }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));

      const byUid = groupBy(matched, uidOf);
      let uniqueIps = 0;
      let returningIps = 0;
      for (const rows of byUid.values()) {
        uniqueIps += 1;
        if (rows.length > 1) returningIps += 1;
      }

      const bySid = groupBy(matched, sidOf);

      return {
        pageViews: matched.length,
        sessions: bySid.size,
        uniqueIps,
        returningIps,
      };
    },

    async series({ filter, granularity, timezone = "UTC" }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      const buckets = new Map();

      for (const doc of matched) {
        const key = bucketOf(doc, granularity, timezone);
        if (!buckets.has(key)) {
          buckets.set(key, { key, pageViews: 0, sessions: new Set(), uids: new Set() });
        }
        const bucket = buckets.get(key);
        bucket.pageViews += 1;
        bucket.sessions.add(sidOf(doc));
        bucket.uids.add(uidOf(doc));
      }

      return [...buckets.values()]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((b) => ({
          key: b.key,
          pageViews: b.pageViews,
          sessions: b.sessions.size,
          uniqueIps: b.uids.size,
        }));
    },

    async hourBreakdown({ filter, timezone = "UTC" }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      const buckets = new Map();

      for (const doc of matched) {
        const hour = Number(bucketOf(doc, "hour", timezone).slice(11, 13));
        if (!buckets.has(hour)) {
          buckets.set(hour, { hour, pageViews: 0, sessions: new Set(), uids: new Set() });
        }
        const bucket = buckets.get(hour);
        bucket.pageViews += 1;
        bucket.sessions.add(sidOf(doc));
        bucket.uids.add(uidOf(doc));
      }

      return [...buckets.values()]
        .sort((a, b) => a.hour - b.hour)
        .map((b) => ({
          hour: b.hour,
          pageViews: b.pageViews,
          sessions: b.sessions.size,
          uniqueIps: b.uids.size,
        }));
    },

    async visitStats({ ips }) {
      const wanted = new Set(ips || []);
      const groups = groupBy(visitors.filter((d) => wanted.has(d.ip)), (d) => d.ip);
      return [...groups.entries()].map(([ip, rows]) => {
        const times = rows.map((r) => new Date(r.createdAt).getTime());
        return {
          ip,
          visits: rows.length,
          firstSeen: new Date(Math.min(...times)),
          lastSeen: new Date(Math.max(...times)),
        };
      });
    },

    async bookmarkStats({ ips }) {
      const wanted = new Set(ips || []);
      const groups = groupBy(visitors.filter((d) => wanted.has(d.ip)), (d) => d.ip);

      return [...groups.entries()].map(([ip, rows]) => {
        const ordered = [...rows].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const latest = ordered[ordered.length - 1];
        const times = ordered.map((r) => new Date(r.createdAt).getTime());
        return {
          ip,
          visits: ordered.length,
          firstSeen: new Date(Math.min(...times)),
          lastSeen: new Date(Math.max(...times)),
          country: latest.country || "Unknown",
          countryCode: latest.countryCode || "",
          city: latest.city || "Unknown",
          region: latest.region || "",
          device: latest.device || "Unknown",
          browser: latest.browser || "Unknown",
          os: latest.os || "Unknown",
          page: latest.page || "/",
          isp: latest.isp || "",
          lat: typeof latest.lat === "number" ? latest.lat : null,
          lng: typeof latest.lng === "number" ? latest.lng : null,
          countries: [...new Set(ordered.map((r) => r.country).filter(Boolean))],
          pages: [...new Set(ordered.map((r) => r.page).filter(Boolean))],
        };
      });
    },

    async bookmarkHistory({ ip, skip, limit }) {
      const matched = visitors.filter((d) => d.ip === ip);
      const sorted = sortDocs(matched, { createdAt: -1 });
      return {
        items: clone(sorted.slice(skip, skip + limit)),
        total: sorted.length,
      };
    },

    async repeatIps({ filter, min, limit }) {
      const matched = visitors.filter((d) => matchesFilter(d, filter));
      const groups = groupBy(matched, uidOf);

      const rows = [];
      for (const [ip, docs] of groups) {
        if (docs.length < min) continue;
        const ordered = [...docs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const latest = ordered[ordered.length - 1];
        const times = ordered.map((r) => new Date(r.createdAt).getTime());
        rows.push({
          ip,
          views: ordered.length,
          pages: [...new Set(ordered.map((r) => r.page).filter(Boolean))],
          sessions: new Set(ordered.map(sidOf)).size,
          firstSeen: new Date(Math.min(...times)),
          lastSeen: new Date(Math.max(...times)),
          country: latest.country || "Unknown",
          city: latest.city || "Unknown",
          device: latest.device || "Unknown",
        });
      }

      return rows
        .sort((a, b) => b.views - a.views || b.lastSeen - a.lastSeen)
        .slice(0, limit);
    },

    async hourlyViews({ from, to }) {
      const counts = new Map();
      for (const doc of visitors) {
        const at = new Date(doc.createdAt);
        if (from && at < from) continue;
        if (to && at > to) continue;
        const key = `${at.toISOString().slice(0, 13)}:00:00.000Z`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, views]) => ({ key, views }));
    },

    async failedLoginSignals({ from, to, limit }) {
      const groups = groupBy(
        securityLogs.filter((l) => {
          if (l.action !== "FAILED_LOGIN") return false;
          const at = new Date(l.createdAt);
          if (from && at < from) return false;
          if (to && at > to) return false;
          return true;
        }),
        (l) => l.ip
      );

      const rows = [];
      for (const [ip, logs] of groups) {
        if (logs.length < 2) continue;
        const last = logs.reduce((max, l) =>
          new Date(l.createdAt).getTime() > new Date(max.createdAt).getTime() ? l : max
        );
        rows.push({
          ip,
          attempts: logs.length,
          lastAttempt: new Date(last.createdAt),
          reason: last.reason || "Repeated failed admin login attempts",
        });
      }

      return rows
        .sort((a, b) => b.attempts - a.attempts || b.lastAttempt - a.lastAttempt)
        .slice(0, limit);
    },

    async blockedTrafficSignals({ from, to, limit }) {
      return securityLogs
        .filter((l) => {
          if (l.action !== "AUTO_BLOCKED_TRAFFIC") return false;
          const at = new Date(l.createdAt);
          if (from && at < from) return false;
          if (to && at > to) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((l) => ({
          ip: l.ip,
          attempts: l.attempts || 1,
          at: new Date(l.createdAt),
          reason: l.reason || "Request volume exceeded the firewall threshold",
          blockedUntil: l.blockedUntil || null,
        }));
    },

    bookmarks: {
      async all() {
        return clone(bookmarks);
      },
      async get(ip) {
        const found = bookmarks.find((b) => b.ip === ip);
        return found ? clone(found) : null;
      },
      async upsert({ ip, label, notes }) {
        let row = bookmarks.find((b) => b.ip === ip);
        const now = new Date();
        if (row) {
          row.label = label;
          row.notes = notes;
          row.updatedAt = now;
        } else {
          seq += 1;
          row = { _id: `bm_${seq}`, ip, label, notes, createdAt: now, updatedAt: now };
          bookmarks.push(row);
        }
        return clone(row);
      },
      async update({ ip, label, notes }) {
        const row = bookmarks.find((b) => b.ip === ip);
        if (!row) return null;
        if (label !== undefined) row.label = label;
        if (notes !== undefined) row.notes = notes;
        row.updatedAt = new Date();
        return clone(row);
      },
      async remove(ip) {
        const index = bookmarks.findIndex((b) => b.ip === ip);
        if (index === -1) return false;
        bookmarks.splice(index, 1);
        return true;
      },
    },

    reviews: {
      async all() {
        return clone(reviews);
      },
      async upsert({ key, status, notes }) {
        let row = reviews.find((r) => r.key === key);
        const now = new Date();
        if (row) {
          row.status = status;
          row.notes = notes;
          row.updatedAt = now;
        } else {
          seq += 1;
          row = { _id: `rev_${seq}`, key, status, notes, updatedAt: now };
          reviews.push(row);
        }
        return clone(row);
      },
    },
  };

  // Used by tests to assert "history survives bookmark removal".
  repo.__countVisitors = () => visitors.length;
  repo.__countBookmarks = () => bookmarks.length;
  repo.__seed = ensure;

  return repo;
}
