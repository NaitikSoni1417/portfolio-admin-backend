import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import requestIp from "request-ip";
import { UAParser } from "ua-parser-js";

dotenv.config();

const app = express();
app.set("trust proxy", true);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(requestIp.mw());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err.message));

const visitorSchema = new mongoose.Schema({
  ip: String,
  visitorId: String,
  page: String,
  browser: String,
  os: String,
  device: String,
  city: String,
  region: String,
  country: String,
  isp: String,
  isp: String,
  lat: Number,
  lng: Number,
  userAgent: String,
  attemptedKey: String,
  city: String,
  region: String,
  country: String,
  isp: String,
  lat: Number,
  lng: Number,
  browser: String,
  os: String,
  device: String,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  ip: String,
  city: String,
  region: String,
  country: String,
  isp: String,
  lat: Number,
  lng: Number,
  browser: String,
  os: String,
  device: String,
  page: String,
  userAgent: String,
  status: { type: String, default: "Unread" },
  createdAt: { type: Date, default: Date.now }
});

const Visitor = mongoose.model("Visitor", visitorSchema);
const Message = mongoose.model("Message", messageSchema);

const securityLogSchema = new mongoose.Schema({
  ip: String,
  action: String,
  reason: String,
  attempts: Number,
  blockedUntil: Date,
  userAgent: String,
  attemptedKey: String,
  city: String,
  region: String,
  country: String,
  isp: String,
  lat: Number,
  lng: Number,
  browser: String,
  os: String,
  device: String,
  createdAt: { type: Date, default: Date.now }
});

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);

const loginAttempts = new Map();

function getClientIp(req, publicIp = "") {
  const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
  return cleanIp(publicIp || forwardedIp || req.clientIp || req.ip);
}

function isBlocked(ip) {
  const item = loginAttempts.get(ip);
  if (!item?.blockedUntil) return false;

  if (Date.now() > item.blockedUntil) {
    loginAttempts.delete(ip);
    return false;
  }

  return true;
}


const settingSchema = new mongoose.Schema({
  adminKey: String,
  maintenanceMode: { type: Boolean, default: false },
  liveTracking: { type: Boolean, default: true },
  adminLogs: [
    {
      action: String,
      ip: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  updatedAt: { type: Date, default: Date.now }
});
const Setting = mongoose.model("Setting", settingSchema);

async function getAdminKey() {
  const setting = await Setting.findOne();
  return setting?.adminKey || process.env.ADMIN_KEY;
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function cleanIp(ip = "") {
  return ip.replace("::ffff:", "").replace("::1", "127.0.0.1");
}

async function getGeo(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "localhost") {
    return {
      city: "Vadodara",
      region: "Gujarat",
      country: "India",
      isp: "Localhost",
      lat: 22.3072,
      lng: 73.1812
    };
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,query`);
    const data = await res.json();

    if (data.status !== "success") throw new Error("Geo failed");

    return {
      city: data.city || data.regionName || "Unknown",
      region: data.regionName || "Unknown",
      country: data.country || "Unknown",
      isp: data.isp || "Unknown",
      lat: data.lat || 22.3072,
      lng: data.lon || 73.1812
    };
  } catch {
    return {
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      isp: "Unknown",
      lat: 22.3072,
      lng: 73.1812
    };
  }
}

app.get("/", (req, res) => {
  res.send("Portfolio Admin Backend Running");
});


app.post("/api/track", async (req, res) => {
  try {
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(req.body.ip || forwardedIp || req.clientIp || req.ip);

    let geo = {};
    try {
      const geoRes = await fetch(`https://ipwho.is/${ip}`);
      geo = await geoRes.json();
    } catch {}

    await Visitor.create({
      ip,
      visitorId: ip,
      page: req.body.page || "/",
      city: req.body.city || geo.city || "Unknown",
      region: req.body.region || geo.region || "Unknown",
      country: req.body.country || geo.country || "Unknown",
      isp: req.body.isp || geo.connection?.isp || "Unknown",
      lat: req.body.lat || geo.latitude || null,
      lng: req.body.lng || geo.longitude || null,
      browser: req.body.browser || "Unknown",
      os: req.body.os || "Unknown",
      device: req.body.device || "Desktop",
      userAgent: req.headers["user-agent"] || "",
      createdAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Tracking failed" });
  }
});


async function lookupIpGeo(ip) {
  const fallback = {
    city: "Unknown",
    region: "Unknown",
    country: "Unknown",
    isp: "Unknown",
    lat: null,
    lng: null
  };

  if (!ip || ip === "127.0.0.1" || ip === "localhost") {
    return {
      city: "Vadodara",
      region: "Gujarat",
      country: "India",
      isp: "Localhost",
      lat: 22.3072,
      lng: 73.1812
    };
  }

  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,org,as,query`);
    const d = await r.json();
    if (d.status === "success") {
      return {
        city: d.city || d.regionName || "Unknown",
        region: d.regionName || "Unknown",
        country: d.country || "Unknown",
        isp: d.isp || d.org || d.as || "Unknown",
        lat: d.lat || null,
        lng: d.lon || null
      };
    }
  } catch {}

  try {
    const r = await fetch(`https://ipwho.is/${ip}`);
    const d = await r.json();
    if (d.success !== false) {
      return {
        city: d.city || "Unknown",
        region: d.region || "Unknown",
        country: d.country || "Unknown",
        isp: d.connection?.isp || d.connection?.org || "Unknown",
        lat: d.latitude || null,
        lng: d.longitude || null
      };
    }
  } catch {}

  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    const d = await r.json();
    if (!d.error) {
      return {
        city: d.city || "Unknown",
        region: d.region || "Unknown",
        country: d.country_name || d.country || "Unknown",
        isp: d.org || d.network || "Unknown",
        lat: d.latitude || null,
        lng: d.longitude || null
      };
    }
  } catch {}

  return fallback;
}

async function getSecurityContext(req, ip, key = "") {
  const geo = await lookupIpGeo(ip);

  const ua = req.headers["user-agent"] || "";
  const browser =
    ua.includes("Edg") ? "Edge" :
    ua.includes("Chrome") ? "Chrome" :
    ua.includes("Safari") ? "Safari" :
    ua.includes("Firefox") ? "Firefox" : "Unknown";

  const os =
    ua.includes("Mac") ? "macOS" :
    ua.includes("Windows") ? "Windows" :
    ua.includes("Android") ? "Android" :
    ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "Unknown";

  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "Desktop";

  const maskedKey =
    key && key.length > 2
      ? `${key.slice(0, 2)}${"*".repeat(Math.max(2, key.length - 4))}${key.slice(-2)}`
      : "***";

  return {
    userAgent: ua,
    attemptedKey: maskedKey,
    city: geo.city || "Unknown",
    region: geo.region || "Unknown",
    country: geo.country || "Unknown",
    isp: geo.isp || "Unknown",
    lat: geo.lat || null,
    lng: geo.lng || null,
    browser,
    os,
    device,
  };
}


app.post("/api/admin/login", async (req, res) => {
  try {
    const { key, publicIp } = req.body;
    const ip = getClientIp(req, publicIp);
    const ua = req.headers["user-agent"] || "";
    const sec = await getSecurityContext(req, ip, key);

    if (isBlocked(ip)) {
      const item = loginAttempts.get(ip);
      return res.status(429).json({
        error: "Blocked",
        blockedUntil: item.blockedUntil
      });
    }

    const correctKey = await getAdminKey();

    if (key !== correctKey) {
      const current = loginAttempts.get(ip) || { count: 0 };
      const count = current.count + 1;

      let blockedUntil = null;

      if (count >= 5) {
        blockedUntil = Date.now() + 60 * 60 * 1000; // 1 hour block
      }

      loginAttempts.set(ip, { count, blockedUntil });

      await SecurityLog.create({
        ip,
        action: "FAILED_LOGIN",
        reason: blockedUntil ? "Blocked" : "Wrong admin password",
        attempts: count,
        blockedUntil: blockedUntil ? new Date(blockedUntil) : null,
        userAgent: ua,
        ...sec
      });

      return res.status(blockedUntil ? 429 : 401).json({
        error: blockedUntil
          ? "Blocked"
          : "Invalid admin key",
        attempts: count
      });
    }

    loginAttempts.delete(ip);

    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    await SecurityLog.create({
      ip,
      action: "SUCCESS_LOGIN",
      reason: "Admin logged in successfully",
      attempts: 0,
      userAgent: ua,
      ...sec
    });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});


app.post("/api/contact", async (req, res) => {
  try {
    const publicIp = req.body.publicIp || "";
    const ip = getClientIp(req, publicIp);
    const geo = await getGeo(ip);

    const ua = req.headers["user-agent"] || req.body.userAgent || "";
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const browser = result.browser?.name || req.body.browser || "Unknown";
    const os = result.os?.name || req.body.os || "Unknown";
    const device = result.device?.type || "Desktop";

    const msg = await Message.create({
      name: req.body.name || "Unknown",
      email: req.body.email || "Unknown",
      message: req.body.message || "",
      ip,
      city: geo.city || "Unknown",
      region: geo.region || "Unknown",
      country: geo.country || "Unknown",
      isp: geo.isp || "Unknown",
      lat: geo.lat || null,
      lng: geo.lng || null,
      browser,
      os,
      device,
      page: req.body.page || "/contact",
      userAgent: ua,
      status: "Unread",
      createdAt: new Date()
    });

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error("Contact save failed:", err.message);
    res.status(500).json({ error: "Contact save failed" });
  }
});


app.get("/api/admin/dashboard", auth, async (req, res) => {
  const totalVisitors = await Visitor.countDocuments();
  const totalMessages = await Message.countDocuments();
  const unreadMessages = await Message.countDocuments({ status: "Unread" });

  // India timezone based today start
  const now = new Date();
  const indiaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  indiaNow.setHours(0, 0, 0, 0);

  // Convert India midnight back to UTC for MongoDB Date comparison
  const todayStart = new Date(indiaNow.getTime() - 5.5 * 60 * 60 * 1000);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const todayViews = await Visitor.countDocuments({ createdAt: { $gte: todayStart } });
  const recentVisitorsRaw = await Visitor.find().sort({ createdAt: -1 }).limit(50);
  const messages = await Message.find().sort({ createdAt: -1 }).limit(20);

  const recentVisitors = await Promise.all(
    recentVisitorsRaw.map(async (v) => {
      const visits = await Visitor.countDocuments({ visitorId: v.visitorId || v.ip });
      const obj = v.toObject();
      obj.visits = visits;
      obj.isReturning = visits > 1;
      return obj;
    })
  );

  const topPages = await Visitor.aggregate([{ $group: { _id: "$page", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]);
  const browsers = await Visitor.aggregate([{ $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  const devices = await Visitor.aggregate([{ $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  const osStats = await Visitor.aggregate([{ $group: { _id: "$os", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

  const countries = await Visitor.aggregate([
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);

  const cities = await Visitor.aggregate([
    { $group: { _id: "$city", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);

  const dailyViews = await Visitor.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%d/%m", date: "$createdAt" } }, views: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    totalVisitors,
    todayViews,
    activeSessions: Math.floor(Math.random() * 10) + 1,
    totalMessages,
    unreadMessages,
    recentVisitors,
    messages,
    topPages,
    browsers,
    devices,
    osStats,
    countries,
    cities,
    dailyViews
  });
});


app.patch("/api/admin/messages/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { status: status || "Read" },
      { new: true }
    );
    res.json({ success: true, message: msg });
  } catch {
    res.status(500).json({ error: "Status update failed" });
  }
});

app.delete("/api/admin/messages/:id", auth, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});


app.patch("/api/admin/change-password", auth, async (req, res) => {
  try {
    const { newKey } = req.body;
    if (!newKey || newKey.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ adminKey: newKey });
    } else {
      setting.adminKey = newKey;
      setting.updatedAt = new Date();
      await setting.save();
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Password update failed" });
  }
});


app.get("/api/admin/command-center", auth, async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});
  res.json({
    maintenanceMode: setting.maintenanceMode || false,
    liveTracking: setting.liveTracking !== false,
    adminLogs: (setting.adminLogs || []).slice(-30).reverse()
  });
});

app.patch("/api/admin/command-center", auth, async (req, res) => {
  const { maintenanceMode, liveTracking, action } = req.body;

  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});

  if (typeof maintenanceMode === "boolean") setting.maintenanceMode = maintenanceMode;
  if (typeof liveTracking === "boolean") setting.liveTracking = liveTracking;

  setting.adminLogs.push({
    action: action || "Command Center updated",
    ip: req.ip
  });

  setting.updatedAt = new Date();
  await setting.save();

  res.json({ success: true, setting });
});

app.delete("/api/admin/visitors", auth, async (req, res) => {
  await Visitor.deleteMany({});
  res.json({ success: true });
});

app.delete("/api/admin/messages", auth, async (req, res) => {
  await Message.deleteMany({});
  res.json({ success: true });
});


app.get("/api/admin/security-logs", auth, async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(logs);
  } catch {
    res.status(500).json({ error: "Security logs failed" });
  }
});


app.get("/api/admin/advanced-analytics", auth, async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(100).lean();

    const failedLoginCount = await SecurityLog.countDocuments({
      action: "FAILED_LOGIN"
    });

    const blockedIps = await SecurityLog.aggregate([
      { $match: { reason: "Blocked" } },
      {
        $group: {
          _id: "$ip",
          attempts: { $max: "$attempts" },
          blockedUntil: { $max: "$blockedUntil" },
          lastSeen: { $max: "$createdAt" }
        }
      },
      { $sort: { lastSeen: -1 } },
      { $limit: 20 }
    ]);

    const hourlyTraffic = await Visitor.aggregate([
      {
        $group: {
          _id: { $hour: "$createdAt" },
          views: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const peak = hourlyTraffic.reduce(
      (max, item) => (item.views > max.views ? item : max),
      { _id: 0, views: 0 }
    );

    const referrers = await Visitor.aggregate([
      {
        $group: {
          _id: "$page",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const suspiciousIps = await SecurityLog.aggregate([
      { $match: { action: "FAILED_LOGIN" } },
      {
        $group: {
          _id: "$ip",
          failedAttempts: { $sum: 1 },
          lastAttempt: { $max: "$createdAt" }
        }
      },
      { $match: { failedAttempts: { $gte: 2 } } },
      { $sort: { failedAttempts: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      logs,
      failedLoginCount,
      blockedIps,
      hourlyTraffic,
      peakTime: {
        hour: peak._id,
        views: peak.views
      },
      referrers,
      suspiciousIps
    });
  } catch (err) {
    res.status(500).json({ error: "Advanced analytics failed" });
  }
});


app.post("/api/admin/ns-ai", auth, async (req, res) => {
  try {
    const { question, dashboard, security } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }

    const prompt = `
You are NS.ai, a premium AI admin agent for Naitik Soni's portfolio admin panel.
Reply in the same language as the user: Gujarati, Hindi, or English.

You can analyze:
- visitors
- messages
- traffic
- countries/cities
- devices
- browsers
- security logs
- failed admin login attempts
- suspicious IPs
- website health

Be professional, short, powerful, and useful.

Admin dashboard data:
${JSON.stringify(dashboard || {}, null, 2)}

Security data:
${JSON.stringify(security || {}, null, 2)}

User question:
${question}
`;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const aiData = await aiRes.json();
    const answer =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "NS.ai could not generate a response right now.";

    res.json({ answer });
  } catch (err) {
    console.error("NS.ai error:", err.message);
    res.status(500).json({ error: "NS.ai failed" });
  }
});


const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
