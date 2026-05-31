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

app.post("/api/admin/login", async (req, res) => {
  if (req.body.key !== await getAdminKey()) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });

  res.json({ token });
});

app.post("/api/track", async (req, res) => {
  try {
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(req.body.publicIp || forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    await Visitor.create({
      ip,
      visitorId: req.body.visitorId || ip,
      page: req.body.page || "/",
      browser: ua.browser.name || "Unknown",
      os: ua.os.name || "Unknown",
      device: ua.device.type || "Desktop",
      city: geo.city,
      country: geo.country,
      isp: geo.isp,
      lat: geo.lat,
      lng: geo.lng,
      userAgent: req.headers["user-agent"]
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Tracking failed" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message, page, publicIp } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields required" });
    }

    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(publicIp || forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    await Message.create({
      name,
      email,
      message,
      ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp: geo.isp,
      lat: geo.lat,
      lng: geo.lng,
      browser: ua.browser.name || "Unknown",
      os: ua.os.name || "Unknown",
      device: ua.device.type || "Desktop",
      page: page || "/contact",
      userAgent: req.headers["user-agent"]
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Message failed" });
  }
});

app.get("/api/admin/dashboard", auth, async (req, res) => {
  const totalVisitors = await Visitor.countDocuments();
  const totalMessages = await Message.countDocuments();
  const unreadMessages = await Message.countDocuments({ status: "Unread" });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

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

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
