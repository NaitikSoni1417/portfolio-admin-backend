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
  page: String,
  browser: String,
  os: String,
  device: String,
  city: String,
  country: String,
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
  status: { type: String, default: "Unread" },
  createdAt: { type: Date, default: Date.now }
});

const Visitor = mongoose.model("Visitor", visitorSchema);
const Message = mongoose.model("Message", messageSchema);

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
      country: "India",
      lat: 22.3072,
      lng: 73.1812
    };
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,query`);
    const data = await res.json();

    if (data.status !== "success") {
      throw new Error("Geo lookup failed");
    }

    return {
      city: data.city || data.regionName || "Unknown",
      country: data.country || "Unknown",
      lat: data.lat || 22.3072,
      lng: data.lon || 73.1812,
      isp: data.isp || "Unknown"
    };
  } catch {
    return {
      city: "Unknown",
      country: "Unknown",
      lat: 22.3072,
      lng: 73.1812,
      isp: "Unknown"
    };
  }
}

app.get("/", (req, res) => {
  res.send("Portfolio Admin Backend Running");
});

app.post("/api/admin/login", (req, res) => {
  if (req.body.key !== process.env.ADMIN_KEY) {
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
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields required" });
    }

    await Message.create({ name, email, message });
    res.json({ success: true });
  } catch {
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
  const recentVisitors = await Visitor.find().sort({ createdAt: -1 }).limit(50);
  const messages = await Message.find().sort({ createdAt: -1 }).limit(20);

  const topPages = await Visitor.aggregate([{ $group: { _id: "$page", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]);
  const browsers = await Visitor.aggregate([{ $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  const devices = await Visitor.aggregate([{ $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  const osStats = await Visitor.aggregate([{ $group: { _id: "$os", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

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
    dailyViews
  });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
