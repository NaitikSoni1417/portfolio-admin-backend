/**
 * Data-access layer for the Visitor Intelligence Center.
 *
 * Every query the routes need lives here so the router stays thin and the same
 * contract can be reimplemented in-memory by the test suite (no MongoDB needed
 * for tests, and production data is never touched).
 *
 * Contract:
 *   list({filter, sort, skip, limit})            -> { items, total }
 *   exportAll({filter, sort, cap})               -> docs[]
 *   facet({filter, field, limit})                -> [{ _id, count }]
 *   series({filter, from, to, granularity})      -> [{ key, pageViews, sessions, uniqueIps }]
 *   hourBreakdown({filter, timezone})            -> [{ hour, pageViews, sessions, uniqueIps }]
 *   metrics({filter})                            -> { pageViews, sessions, uniqueIps, returningIps }
 *   visitStats({ips})                            -> [{ ip, visits, firstSeen, lastSeen }]
 *   bookmarkStats({ips})                         -> [{ ip, visits, firstSeen, lastSeen, ... }]
 *   repeatIps({filter, min, limit})              -> [{ ip, views, sessions, ... }]
 *   hourlyViews({from, to})                      -> [{ key, views }]
 *   failedLoginSignals({from, to, limit})        -> [{ ip, attempts, lastAttempt, reason }]
 *   blockedTrafficSignals({from, to, limit})     -> [{ ip, attempts, at, reason }]
 *   bookmarks: { all, get, upsert, update, remove }
 *   bookmarkHistory({ip, skip, limit})           -> { items, total }
 *   reviews:   { all, upsert }
 *   ipLabels:  { all, list, get, getByIp, create, update, remove, mapForIps }
 *   exportCursor({filter, sort, cap})            -> async iterable of docs (streaming)
 */

import { normalizeIp } from "./visitorQuery.js";

const uidExpr = {
  $cond: [{ $eq: [{ $ifNull: ["$visitorId", ""] }, ""] }, "$ip", "$visitorId"],
};

// A record without a sessionId cannot belong to a real session, so it is counted
// as its own session (documented behaviour — never silently merged away).
const sidExpr = {
  $cond: [
    { $eq: [{ $ifNull: ["$sessionId", ""] }, ""] },
    { $concat: ["anon:", { $toString: "$_id" }] },
    { $ifNull: ["$sessionId", ""] },
  ],
};

function bucketExpr(granularity) {
  return granularity === "hour"
    ? { $dateToString: { format: "%Y-%m-%dT%H:00:00.000Z", date: "$createdAt" } }
    : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
}

export function createMongoRepo({ Visitor, SecurityLog, IpBookmark, AnomalyReview, IpLabel }) {
  return {
    async list({ filter, sort, skip, limit }) {
      const [items, total] = await Promise.all([
        Visitor.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        Visitor.countDocuments(filter),
      ]);
      return { items, total };
    },
    /** Row count for a filter — used by the streaming exporter's headers. */
    async count({ filter }) {
      return Visitor.countDocuments(filter);
    },

    async exportAll({ filter, sort, cap }) {
      const rows = [];
      const cursor = Visitor.find(filter).sort(sort).lean().cursor();
      for await (const doc of cursor) {
        rows.push(doc);
        if (rows.length >= cap) break;
      }
      return rows;
    },

    /**
     * Streaming export: yields docs one at a time from a real Mongo cursor so
     * large exports never materialise the whole collection in memory. The
     * caller is responsible for closing the cursor on completion, error or
     * client disconnect — the returned object exposes `close()`.
     */
    exportCursor({ filter, sort, cap }) {
      const cursor = Visitor.find(filter).sort(sort).lean().cursor();
      let count = 0;
      async function* stream() {
        try {
          for await (const doc of cursor) {
            if (count >= cap) break;
            count += 1;
            yield doc;
          }
        } finally {
          await cursor.close().catch(() => {});
        }
      }
      return { stream: stream, close: () => cursor.close().catch(() => {}) };
    },

    /**
     * Unique IPs matching a filter (projection: ip only) — a cheap first pass
     * for the exporter's enrichment maps, never loads full documents.
     */
    async exportIps({ filter, cap }) {
      const ips = new Set();
      const cursor = Visitor.find(filter).select("ip").lean().cursor();
      for await (const doc of cursor) {
        if (doc?.ip) ips.add(doc.ip);
        if (ips.size >= cap) break;
      }
      await cursor.close().catch(() => {});
      return [...ips];
    },

    /**
     * Facet a field, with an optional fallback field for records written
     * before the primary one existed (e.g. `trafficSourceKey` → `referrer`).
     */
    async facet({ filter, field, limit, fallbackField }) {
      const idExpr = fallbackField
        ? { $ifNull: [`$${field}`, `$${fallbackField}`, "Unknown"] }
        : { $ifNull: [`$${field}`, "Unknown"] };
      return Visitor.aggregate([
        { $match: filter },
        { $group: { _id: idExpr, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: limit },
      ]);
    },

    async metrics({ filter }) {
      const [byUid] = await Visitor.aggregate([
        { $match: filter },
        { $group: { _id: uidExpr, n: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            pageViews: { $sum: "$n" },
            uniqueIps: { $sum: 1 },
            returningIps: { $sum: { $cond: [{ $gt: ["$n", 1] }, 1, 0] } },
          },
        },
      ]).limit(1);

      const [bySid] = await Visitor.aggregate([
        { $match: filter },
        { $group: { _id: sidExpr, views: { $sum: 1 } } },
        { $group: { _id: null, sessions: { $sum: 1 } } },
      ]).limit(1);

      return {
        pageViews: byUid?.pageViews ?? 0,
        sessions: bySid?.sessions ?? 0,
        uniqueIps: byUid?.uniqueIps ?? 0,
        returningIps: byUid?.returningIps ?? 0,
      };
    },

    async series({ filter, granularity }) {
      const rows = await Visitor.aggregate([
        { $match: filter },
        { $group: { _id: { bucket: bucketExpr(granularity), sid: sidExpr, uid: uidExpr }, views: { $sum: 1 } } },
        {
          $group: {
            _id: "$_id.bucket",
            sessions: { $sum: 1 },
            pageViews: { $sum: "$views" },
            uids: { $addToSet: "$_id.uid" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return rows.map((r) => ({
        key: r._id,
        pageViews: r.pageViews,
        sessions: r.sessions,
        uniqueIps: new Set(r.uids || []).size,
      }));
    },

    /**
     * 24-bucket "traffic by hour of day" in the requested timezone, collapsed
     * across the whole range. `timezone` is an IANA name resolved by MongoDB.
     */
    async hourBreakdown({ filter, timezone = "UTC" }) {
      const rows = await Visitor.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              hour: { $hour: { date: "$createdAt", timezone } },
              sid: sidExpr,
              uid: uidExpr,
            },
            views: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.hour",
            sessions: { $sum: 1 },
            pageViews: { $sum: "$views" },
            uids: { $addToSet: "$_id.uid" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return rows.map((r) => ({
        hour: Number(r._id),
        pageViews: r.pageViews,
        sessions: r.sessions,
        uniqueIps: new Set(r.uids || []).size,
      }));
    },

    async visitStats({ ips }) {
      if (!ips || ips.length === 0) return [];
      const rows = await Visitor.aggregate([
        { $match: { ip: { $in: ips } } },
        {
          $group: {
            _id: "$ip",
            visits: { $sum: 1 },
            firstSeen: { $min: "$createdAt" },
            lastSeen: { $max: "$createdAt" },
          },
        },
      ]);
      return rows.map((r) => ({
        ip: r._id,
        visits: r.visits,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
      }));
    },

    async bookmarkStats({ ips }) {
      if (!ips || ips.length === 0) return [];
      const rows = await Visitor.aggregate([
        { $match: { ip: { $in: ips } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$ip",
            visits: { $sum: 1 },
            firstSeen: { $min: "$createdAt" },
            lastSeen: { $max: "$createdAt" },
            country: { $last: "$country" },
            countryCode: { $last: "$countryCode" },
            city: { $last: "$city" },
            region: { $last: "$region" },
            device: { $last: "$device" },
            browser: { $last: "$browser" },
            os: { $last: "$os" },
            page: { $last: "$page" },
            isp: { $last: "$isp" },
            lat: { $last: "$lat" },
            lng: { $last: "$lng" },
            countries: { $addToSet: "$country" },
            pages: { $addToSet: "$page" },
          },
        },
        { $sort: { lastSeen: -1 } },
      ]);

      return rows.map((r) => ({
        ip: r._id,
        visits: r.visits,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        country: r.country || "Unknown",
        countryCode: r.countryCode || "",
        city: r.city || "Unknown",
        region: r.region || "",
        device: r.device || "Unknown",
        browser: r.browser || "Unknown",
        os: r.os || "Unknown",
        page: r.page || "/",
        isp: r.isp || "",
        lat: typeof r.lat === "number" ? r.lat : null,
        lng: typeof r.lng === "number" ? r.lng : null,
        countries: (r.countries || []).filter(Boolean),
        pages: (r.pages || []).filter(Boolean),
      }));
    },

    /**
     * Paginated visit history for a single IP. Read-only over the Visitor
     * collection — never mutates or deletes visitor documents.
     */
    async bookmarkHistory({ ip, skip, limit }) {
      const filter = { ip };
      const [items, total] = await Promise.all([
        Visitor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Visitor.countDocuments(filter),
      ]);
      return { items, total };
    },

    async repeatIps({ filter, min, limit }) {
      const rows = await Visitor.aggregate([
        { $match: filter },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: uidExpr,
            views: { $sum: 1 },
            pages: { $addToSet: "$page" },
            sids: { $addToSet: sidExpr },
            firstSeen: { $min: "$createdAt" },
            lastSeen: { $max: "$createdAt" },
            country: { $last: "$country" },
            city: { $last: "$city" },
            device: { $last: "$device" },
          },
        },
        { $match: { views: { $gte: min } } },
        { $sort: { views: -1, lastSeen: -1 } },
        { $limit: limit },
      ]);

      return rows.map((r) => ({
        ip: r._id,
        views: r.views,
        pages: (r.pages || []).filter(Boolean),
        sessions: new Set(r.sids || []).size,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        country: r.country || "Unknown",
        city: r.city || "Unknown",
        device: r.device || "Unknown",
      }));
    },

    async hourlyViews({ from, to }) {
      const match = {};
      if (from) match.createdAt = { ...(match.createdAt || {}), $gte: from };
      if (to) match.createdAt = { ...(match.createdAt || {}), $lte: to };

      const rows = await Visitor.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%dT%H:00:00.000Z", date: "$createdAt" } },
            views: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return rows.map((r) => ({ key: r._id, views: r.views }));
    },

    async failedLoginSignals({ from, to, limit }) {
      const match = { action: "FAILED_LOGIN" };
      if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = from;
        if (to) match.createdAt.$lte = to;
      }

      const rows = await SecurityLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$ip",
            attempts: { $sum: 1 },
            lastAttempt: { $max: "$createdAt" },
            reason: { $last: "$reason" },
          },
        },
        { $match: { attempts: { $gte: 2 } } },
        { $sort: { attempts: -1, lastAttempt: -1 } },
        { $limit: limit },
      ]);

      return rows.map((r) => ({
        ip: r._id,
        attempts: r.attempts,
        lastAttempt: r.lastAttempt,
        reason: r.reason || "Repeated failed admin login attempts",
      }));
    },

    async blockedTrafficSignals({ from, to, limit }) {
      const match = { action: "AUTO_BLOCKED_TRAFFIC" };
      if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = from;
        if (to) match.createdAt.$lte = to;
      }

      const rows = await SecurityLog.find(match).sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map((r) => ({
        ip: r.ip,
        attempts: r.attempts || 1,
        at: r.createdAt,
        reason: r.reason || "Request volume exceeded the firewall threshold",
        blockedUntil: r.blockedUntil || null,
      }));
    },

    bookmarks: {
      async all() {
        return IpBookmark.find().sort({ updatedAt: -1 }).lean();
      },
      async get(ip) {
        return IpBookmark.findOne({ ip }).lean();
      },
      async upsert({ ip, label, notes }) {
        return IpBookmark.findOneAndUpdate(
          { ip },
          { $set: { ip, label, notes, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      },
      async update({ ip, label, notes }) {
        const set = { updatedAt: new Date() };
        if (label !== undefined) set.label = label;
        if (notes !== undefined) set.notes = notes;
        return IpBookmark.findOneAndUpdate({ ip }, { $set: set }, { new: true }).lean();
      },
      async remove(ip) {
        const res = await IpBookmark.deleteOne({ ip });
        return res.deletedCount > 0;
      },
    },

    reviews: {
      async all() {
        return AnomalyReview.find().lean();
      },
      async upsert({ key, status, notes }) {
        return AnomalyReview.findOneAndUpdate(
          { key },
          { $set: { key, status, notes, updatedAt: new Date() } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      },
    },

    ipLabels: {
      async all() {
        return IpLabel.find().sort({ updatedAt: -1 }).lean();
      },
      /** Paginated + filtered list; search matches ip/displayName/hostname/note. */
      async list({ filter, skip, limit }) {
        const [items, total] = await Promise.all([
          IpLabel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
          IpLabel.countDocuments(filter),
        ]);
        return { items, total };
      },
      async get(id) {
        return IpLabel.findById(id).lean();
      },
      async getByIp(normalizedIp) {
        return IpLabel.findOne({ normalizedIp }).lean();
      },
      async create({ normalizedIp, displayName, category, hostname, note }) {
        const now = new Date();
        const doc = await IpLabel.create({
          normalizedIp,
          displayName,
          category,
          hostname: hostname || "",
          note: note || "",
          createdAt: now,
          updatedAt: now,
        });
        return doc.toObject();
      },
      async update(id, patch) {
        return IpLabel.findByIdAndUpdate(
          id,
          { $set: { ...patch, updatedAt: new Date() } },
          { new: true, runValidators: true }
        ).lean();
      },
      async remove(id) {
        const res = await IpLabel.deleteOne({ _id: id });
        return res.deletedCount > 0;
      },
      /**
       * Batch label lookup for a set of raw IPs — one `$in` query, never N+1.
       * Returns [{ normalizedIp, displayName, category }].
       */
      async mapForIps(ips = []) {
        const normalized = [...new Set(ips.map((ip) => normalizeIp(ip)).filter(Boolean))];
        if (!normalized.length) return [];
        const rows = await IpLabel.find({ normalizedIp: { $in: normalized } })
          .select("normalizedIp displayName category")
          .lean();
        return rows.map((r) => ({
          normalizedIp: r.normalizedIp,
          displayName: r.displayName,
          category: r.category,
        }));
      },
    },
  };
}
