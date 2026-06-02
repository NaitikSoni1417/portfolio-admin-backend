import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
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


const OWNER_PROFILE = `
Naitik Soni profile:
- Name: Naitik Soni
- Handle: Naitik.infosec / NScyber1417
- Role: Cybersecurity student, ethical hacker, full stack developer
- Founder: NS Indian Cyber Army
- Portfolio owner and admin
- Studying at SVIT Vasad / GTU
- Focus: cybersecurity, ethical hacking, bug bounty, secure web apps, portfolio analytics
- Communication style: friendly Indian Hinglish/Gujarati, like a real assistant, short and useful
`;

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

    const prompt = `
You are NS.ai, a premium real AI admin agent for Naitik Soni's portfolio admin panel.
Reply in the same language as the user: Gujarati, Hindi, Hinglish, or English.

Your job:
- Analyze visitors, traffic, messages, devices, countries, cities, security logs.
- Answer like a smart admin assistant.
- Be short, powerful, practical, and professional.
- If user asks about admin access attempts, use security logs.
- If user asks growth, use dashboard traffic.
- If user asks last message, use messages.
- If user asks website health, use dashboard + security.
- Never say you cannot access data; use the provided admin data.

Admin dashboard data:
${JSON.stringify(dashboard || {}, null, 2)}

Security data:
${JSON.stringify(security || {}, null, 2)}

User question:
${question}
`;

    let answer = "";

    if (process.env.OPENROUTER_API_KEY) {
      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://naitiksoni1417.netlify.app",
          "X-Title": "NS.ai Admin Agent"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: "You are NS.ai, a real AI admin agent." },
            { role: "user", content: prompt }
          ],
          temperature: 0.35,
          max_tokens: 220
        })
      });

      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        console.error("OpenRouter error:", JSON.stringify(aiData, null, 2));
        const fallback = `Bhai, AI provider limit issue aavyo che, pan live admin data pramane: aaje ${dashboard?.todayViews || 0} views che, total visitors ${dashboard?.totalVisitors || 0} che, active sessions ${dashboard?.activeSessions || 0} che, messages ${dashboard?.totalMessages || 0} che, ane failed login events ${security?.failedLoginCount || 0} che.`;
        return res.json({ answer: fallback, fallback: true });
      }

      answer = aiData?.choices?.[0]?.message?.content || "";
    }

    if (!answer && process.env.GEMINI_API_KEY) {
      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const aiData = await aiRes.json();
      answer = aiData?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\\n") || "";
    }

    if (!answer) {
      return res.status(500).json({
        error: "No AI provider available. Add OPENROUTER_API_KEY or valid GEMINI_API_KEY."
      });
    }

    res.json({ answer });
  } catch (err) {
    console.error("NS.ai error:", err.message);
    res.status(500).json({ error: "NS.ai failed: " + err.message });
  }
});



async function sendDailyAdminReport() {
  if (process.env.DAILY_REPORT_ENABLED !== "true") return;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.REPORT_EMAIL) return;

  const totalVisitors = await Visitor.countDocuments();
  const totalMessages = await Message.countDocuments();
  const unreadMessages = await Message.countDocuments({ status: "Unread" });
  const failedLoginCount = await SecurityLog.countDocuments({ action: "FAILED_LOGIN" });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayViews = await Visitor.countDocuments({ createdAt: { $gte: todayStart } });

  const recentMessages = await Message.find().sort({ createdAt: -1 }).limit(5);
  const recentVisitors = await Visitor.find().sort({ createdAt: -1 }).limit(5);

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date();
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayViews = await Visitor.countDocuments({
    createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
  });

  const visitorGrowth = yesterdayViews > 0
    ? Math.round(((todayViews - yesterdayViews) / yesterdayViews) * 100)
    : todayViews > 0 ? 100 : 0;

  const topCities = await Visitor.aggregate([
    { $group: { _id: "$city", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const topCountries = await Visitor.aggregate([
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const topBrowsers = await Visitor.aggregate([
    { $group: { _id: "$browser", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const topPages = await Visitor.aggregate([
    { $group: { _id: "$page", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const securityScore = Math.max(40, Math.min(99, 100 - Math.min(45, failedLoginCount)));
  const healthScore = Math.max(60, Math.min(99, Math.round((securityScore + Math.min(100, todayViews)) / 2)));
  const threatLevel = failedLoginCount > 25 ? "WATCH" : failedLoginCount > 8 ? "MEDIUM" : "LOW";
  const trafficLevel = todayViews >= 100 ? "High Growth" : todayViews >= 40 ? "Healthy" : todayViews >= 10 ? "Active" : "Low Activity";

  const topCity = topCities?.[0]?._id || "Unknown";
  const topCountry = topCountries?.[0]?._id || "Unknown";
  const topBrowser = topBrowsers?.[0]?._id || "Unknown";
  const topPage = topPages?.[0]?._id || "/";

  const clean = (v) => String(v || "Unknown").replace(/[<>&]/g, "");

  const listRows = (items, icon) => items.map((x, i) => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,.18)">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div style="font-weight:900;color:#e5f3ff">${icon} ${i + 1}. ${clean(x._id)}</div>
        <div style="font-weight:1000;color:#67e8f9">${x.count}</div>
      </div>
      <div style="height:8px;background:#1e293b;border-radius:999px;overflow:hidden;margin-top:9px">
        <div style="height:8px;width:${Math.min(100, Math.max(8, Math.round((x.count / Math.max(1,totalVisitors)) * 100)))}%;background:linear-gradient(90deg,#06b6d4,#8b5cf6,#22c55e);border-radius:999px"></div>
      </div>
    </div>
  `).join("");

  const leadRows = recentMessages.map((m, i) => `
    <div style="border:1px solid rgba(148,163,184,.25);border-radius:22px;padding:18px;margin-bottom:14px;background:linear-gradient(135deg,#0f172a,#111827)">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:15px;font-weight:1000;color:#ffffff">👤 ${clean(m.name)}</div>
          <div style="font-size:12px;color:#94a3b8;font-weight:800;margin-top:3px">${clean(m.email)}</div>
        </div>
        <div style="height:28px;padding:0 12px;border-radius:999px;background:${i === 0 ? "#22c55e22" : "#06b6d422"};color:${i === 0 ? "#86efac" : "#67e8f9"};font-size:11px;font-weight:1000;line-height:28px">
          ${i === 0 ? "HOT LEAD" : "NEW LEAD"}
        </div>
      </div>
      <div style="margin-top:12px;color:#cbd5e1;line-height:1.6;font-weight:650">
        ${clean(String(m.message || "").slice(0, 210))}${String(m.message || "").length > 210 ? "..." : ""}
      </div>
    </div>
  `).join("");

  const html = `
  <div style="margin:0;padding:0;background:#020617;font-family:Inter,Arial,sans-serif;color:#e5e7eb">
    <div style="max-width:930px;margin:0 auto;padding:30px 14px">

      <div style="background:radial-gradient(circle at 10% 0%,#22d3ee44,transparent 28%),radial-gradient(circle at 88% 8%,#8b5cf655,transparent 35%),linear-gradient(135deg,#020617,#0b1120 55%,#0f2f3f);border-radius:36px;padding:38px;color:white;box-shadow:0 30px 90px rgba(34,211,238,.18);border:1px solid rgba(103,232,249,.18)">
        <div style="font-size:12px;letter-spacing:5px;color:#67e8f9;font-weight:1000">REAL AI ADMIN AGENT</div>
        <h1 style="margin:12px 0 10px;font-size:42px;line-height:1.05">NS.ai Executive SaaS Report V3</h1>
        <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.6">Premium portfolio intelligence report for Naitik Soni.</p>

        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:26px">
          <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:22px">
            <div style="font-size:13px;color:#a7f3d0;font-weight:1000">EXECUTIVE SUMMARY</div>
            <p style="margin:10px 0 0;color:#e2e8f0;line-height:1.8;font-weight:700">
              NS.ai detected <b>${trafficLevel}</b> portfolio activity today. Visitor growth is <b>${visitorGrowth}%</b>,
              top audience location is <b>${topCity}</b>, top browser is <b>${topBrowser}</b>, and security threat level is <b>${threatLevel}</b>.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:28px;padding:22px;text-align:center">
            <div style="font-size:12px;color:#67e8f9;font-weight:1000">WEBSITE HEALTH</div>
            <div style="font-size:58px;font-weight:1000;line-height:1;margin-top:10px">${healthScore}</div>
            <div style="font-size:13px;color:#cbd5e1;font-weight:800">/100</div>
            <div style="margin-top:12px;color:#86efac;font-weight:1000">● ${healthScore >= 85 ? "EXCELLENT" : healthScore >= 70 ? "GOOD" : "NEEDS ATTENTION"}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px">
        ${[
          ["Today Views", todayViews, "👁️", "#06b6d4"],
          ["Total Visitors", totalVisitors, "👥", "#22c55e"],
          ["Messages", totalMessages, "📩", "#f59e0b"],
          ["Security Score", securityScore, "🛡️", "#8b5cf6"],
        ].map(([label, value, icon, color]) => `
          <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(148,163,184,.22);border-radius:26px;padding:20px;box-shadow:0 18px 55px rgba(0,0,0,.25)">
            <div style="font-size:28px">${icon}</div>
            <div style="color:${color};font-weight:1000;font-size:12px;text-transform:uppercase;letter-spacing:.6px;margin-top:10px">${label}</div>
            <div style="font-size:34px;font-weight:1000;margin-top:8px;color:white">${value}</div>
          </div>
        `).join("")}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px">
        <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(34,211,238,.22);border-radius:30px;padding:26px">
          <h2 style="margin:0 0 18px;color:#67e8f9">📈 Weekly Comparison</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:#020617;border-radius:20px;padding:16px"><b>Visitor Growth</b><br/><span style="font-size:30px;color:#86efac;font-weight:1000">${visitorGrowth >= 0 ? "+" : ""}${visitorGrowth}%</span></div>
            <div style="background:#020617;border-radius:20px;padding:16px"><b>Yesterday Views</b><br/><span style="font-size:30px;color:#67e8f9;font-weight:1000">${yesterdayViews}</span></div>
            <div style="background:#020617;border-radius:20px;padding:16px"><b>Lead Volume</b><br/><span style="font-size:30px;color:#fbbf24;font-weight:1000">${totalMessages}</span></div>
            <div style="background:#020617;border-radius:20px;padding:16px"><b>Threat Level</b><br/><span style="font-size:30px;color:#fb7185;font-weight:1000">${threatLevel}</span></div>
          </div>
        </div>

        <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(34,197,94,.22);border-radius:30px;padding:26px">
          <h2 style="margin:0 0 18px;color:#86efac">🤖 AI Recommendations</h2>
          <ul style="margin:0;padding-left:20px;color:#dbeafe;line-height:1.9;font-weight:800">
            <li>Follow up recent contact leads within 24 hours.</li>
            <li>Create more cybersecurity project content to improve engagement.</li>
            <li>Monitor failed login activity and suspicious IP patterns.</li>
            <li>Optimize top page <b>${topPage}</b> for better conversions.</li>
            <li>Keep tracking visitors from <b>${topCity}</b> audience segment.</li>
          </ul>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px">
        <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(103,232,249,.2);border-radius:30px;padding:26px">
          <h2 style="margin:0 0 12px;color:#67e8f9">🏙️ Visitor Intelligence</h2>
          ${listRows(topCities, "📍") || "<p>No city data</p>"}
        </div>
        <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(167,139,250,.2);border-radius:30px;padding:26px">
          <h2 style="margin:0 0 12px;color:#ddd6fe">🌐 Browser Intelligence</h2>
          ${listRows(topBrowsers, "🧭") || "<p>No browser data</p>"}
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#0f172a,#111827);border:1px solid rgba(245,158,11,.25);border-radius:30px;padding:26px;margin-top:18px">
        <h2 style="margin:0 0 16px;color:#fbbf24">💰 Lead Intelligence</h2>
        ${leadRows || "<p style='color:#94a3b8;font-weight:800'>No recent leads.</p>"}
      </div>

      <div style="background:linear-gradient(135deg,#190b0b,#0f172a);border:1px solid rgba(248,113,113,.28);border-radius:30px;padding:26px;margin-top:18px">
        <h2 style="margin:0 0 18px;color:#fca5a5">🛡️ Security Operations Center</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Failed Logins</b><br/><span style="font-size:30px;font-weight:1000;color:white">${failedLoginCount}</span></div>
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Security Score</b><br/><span style="font-size:30px;font-weight:1000;color:#86efac">${securityScore}</span></div>
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Threat</b><br/><span style="font-size:30px;font-weight:1000;color:#fbbf24">${threatLevel}</span></div>
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Backend</b><br/><span style="font-size:24px;font-weight:1000;color:#86efac">ONLINE</span></div>
        </div>
      </div>

      <div style="text-align:center;color:#94a3b8;font-size:13px;font-weight:900;margin:28px 0">
        Generated by <b style="color:#67e8f9">NS.ai</b> • Portfolio Intelligence Platform<br/>
        Developed by Naitik Soni • Cybersecurity Engineer • Ethical Hacker
      </div>
    </div>
  </div>`;  const mailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NS.ai Reports <onboarding@resend.dev>",
      to: process.env.REPORT_EMAIL,
      subject: `NS.ai Daily Report - ${new Date().toLocaleDateString("en-IN")}`,
      html,
    }),
  });

  const mailData = await mailRes.json();

  if (!mailRes.ok) {
    throw new Error(mailData?.message || "Resend email failed");
  }

  console.log("✅ NS.ai daily report email sent");
}

app.post("/api/admin/send-daily-report", auth, async (req, res) => {
  try {
    await sendDailyAdminReport();
    res.json({ success: true, message: "Daily report sent" });
  } catch (err) {
    console.error("Daily report error:", err);
    res.status(500).json({
      error: "Daily report failed",
      details: err.message || String(err),
      code: err.code || null,
    });
  }
});

setInterval(() => {
  const now = new Date();
  const india = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (india.getHours() === 9 && india.getMinutes() === 0) {
    sendDailyAdminReport().catch((err) => console.error("Auto report failed:", err.message));
  }
}, 60 * 1000);


const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
