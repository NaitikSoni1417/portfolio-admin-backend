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
 */

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

export function createMongoRepo({ Visitor, SecurityLog, IpBookmark, AnomalyReview }) {
  return {
    async list({ filter, sort, skip, limit }) {
      const [items, total] = await Promise.all([
        Visitor.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        Visitor.countDocuments(filter),
      ]);
      return { items, total };
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

    async facet({ filter, field, limit }) {
      return Visitor.aggregate([
        { $match: filter },
        { $group: { _id: { $ifNull: [`$${field}`, "Unknown"] }, count: { $sum: 1 } } },
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
  };
}
