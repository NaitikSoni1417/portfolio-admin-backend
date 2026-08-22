import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import jwt from "jsonwebtoken";
import requestIp from "request-ip";
import { UAParser } from "ua-parser-js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { GoogleGenerativeAI } from "@google/generative-ai";
import helmet from "helmet";

dotenv.config();

// Google Generative AI — initialized once at startup for the /api/ns-ai endpoint.
// If GEMINI_API_KEY is missing, genAI will be null and the route returns a 503.
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only audio files are allowed"));
    }
    cb(null, true);
  }
});

const app = express();
app.set("trust proxy", true);
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Public-IP"],
  exposedHeaders: ["Content-Disposition"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(requestIp.mw());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err.message));

const visitorSchema = new mongoose.Schema({
  ip: String,
  visitorId: String,
  page: String,
  sessionId: String,
  sessionDuration: { type: Number, default: 0 },
  pagesViewed: [String],
  screen: String,
  language: String,
  timezone: String,
  referrer: String,
  browser: String,
  os: String,
  device: String,
  city: String,
  region: String,
  country: String,
  countryCode: { type: String, default: "" },
  isp: String,
  lat: Number,
  lng: Number,
  userAgent: String,
  attemptedKey: String,
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
  countryCode: { type: String, default: "" },
  isp: String,
  lat: Number,
  lng: Number,
  browser: String,
  os: String,
  device: String,
  page: String,
  sessionId: String,
  sessionDuration: { type: Number, default: 0 },
  pagesViewed: [String],
  screen: String,
  language: String,
  timezone: String,
  referrer: String,
  userAgent: String,
  status: { type: String, default: "Unread" },
  reply: String,
  repliedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const Visitor = mongoose.model("Visitor", visitorSchema);

const resumeDownloadSchema = new mongoose.Schema({
  ip: String,
  publicIp: String,
  page: String,
  sessionId: String,
  sessionDuration: { type: Number, default: 0 },
  pagesViewed: [String],
  screen: String,
  language: String,
  timezone: String,
  referrer: String,
  city: String,
  region: String,
  country: String,
  countryCode: { type: String, default: "" },
  isp: String,
  browser: String,
  os: String,
  device: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});
const ResumeDownload = mongoose.model("ResumeDownload", resumeDownloadSchema);
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
  countryCode: { type: String, default: "" },
  isp: String,
  lat: Number,
  lng: Number,
  browser: String,
  os: String,
  device: String,
  createdAt: { type: Date, default: Date.now }
});

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);

const blockedIpSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  reason: { type: String, default: "Blocked by NS.ai SOC" },
  blockedBy: { type: String, default: "Admin" },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
const BlockedIP = mongoose.model("BlockedIP", blockedIpSchema);

const musicTrackSchema = new mongoose.Schema({
  title: String,
  url: String,
  publicId: String,
  size: Number,
  format: String,
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 999 },
  createdAt: { type: Date, default: Date.now }
});
const MusicTrack = mongoose.model("MusicTrack", musicTrackSchema);

const musicPlaySchema = new mongoose.Schema({
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicTrack" },
  title: String,
  ip: String,
  city: String,
  country: String,
  countryCode: { type: String, default: "" },
  browser: String,
  os: String,
  device: String,
  page: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});
const MusicPlay = mongoose.model("MusicPlay", musicPlaySchema);

const portfolioContentSchema = new mongoose.Schema({
  heroTitle: { type: String, default: "Naitik Soni" },
  heroSubtitle: { type: String, default: "Cybersecurity Engineer & Ethical Hacker" },
  profilePhoto: { type: String, default: "" },
  cpiText: { type: String, default: "Cybersecurity Engineer • Founder • Full Stack Developer" },
  statRank: { type: String, default: "20%" },
  statSuccess: { type: String, default: "100%" },
  statCompanies: { type: String, default: "10+" },
  statCpi: { type: String, default: "6.9" },
  aboutText: { type: String, default: "I am <b>Naitik Soni</b> (<span data-cyan=\"true\">NScyber1417</span>), a <b>Cybersecurity Engineer</b>, <span data-cyan=\"true\">Ethical Hacker</span>, and <b>Full Stack Developer</b> focused on building <span data-cyan=\"true\">secure, scalable, and high-performance</span> digital systems. Currently studying at <b>Gujarat Technological University (GTU)</b> via <span data-cyan=\"true\">SVIT Vasad</span>. Passionate about <b>ethical hacking</b>, <span data-cyan=\"true\">building secure systems</span>, and solving <b>real-world security challenges</b>.<br><br>With a <b>Global Rank of 20% on TryHackMe</b>, I specialize in <span data-cyan=\"true\">practical cybersecurity</span>, <b>offensive security research</b>, <span data-cyan=\"true\">penetration testing</span>, and <b>vulnerability analysis</b>.<br><br>I developed <b>WebinfoX</b>, a <span data-cyan=\"true\">Python-based reconnaissance automation toolkit</span> focused on domain intelligence gathering, infrastructure discovery, DNS analysis, and attack surface mapping.<br><br>I also built <b>NSphotoX</b>, an <span data-cyan=\"true\">advanced image OSINT & metadata forensics platform</span> designed for ethical cybersecurity investigations. It includes EXIF metadata analysis, GPS intelligence, OCR extraction, AI-powered risk analysis, reverse image search integration, HTML/PDF forensic reporting, and cyberpunk-style investigation dashboards.<br><br>I am also the <span data-cyan=\"true\">Founder of NS Indian Cyber Army's</span>, a growing cybersecurity community with <b>500+ active members</b> from <span data-cyan=\"true\">33+ different countries</span>. I actively mentor juniors in <b>Penetration Testing</b>, <span data-cyan=\"true\">Malware Analysis</span>, and <b>IOT Security</b> while promoting ethical hacking and cybersecurity awareness.<br><br>Alongside cybersecurity, I work with <span data-cyan=\"true\">React</span>, <b>Tailwind CSS</b>, <span data-cyan=\"true\">Node.js</span>, <b>Python/Flask</b>, <span data-cyan=\"true\">MySQL</span>, and <b>MongoDB</b>.<br><br>Beyond technical development, I am also the <span data-cyan=\"true\">Founder of NS Indian Cyber Army's</span>, a rapidly growing cybersecurity community with <b>500+ active members</b> across <span data-cyan=\"true\">33+ different countries</span>. Through this initiative, I actively mentor juniors in <b>Penetration Testing</b>, <span data-cyan=\"true\">Malware Analysis</span>, and <b>IOT Security</b> while promoting ethical hacking, responsible disclosure, and practical cybersecurity learning within the community." },
  resumeUrl: { type: String, default: "/Resume-Naitik-Soni.pdf" },
  githubUrl: { type: String, default: "" },
  linkedinUrl: { type: String, default: "" },
  instagramUrl: { type: String, default: "" },
  copyrightYear: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
});
const PortfolioContent = mongoose.model("PortfolioContent", portfolioContentSchema);

const portfolioProjectSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: { type: String, default: "LIVE" },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  techStack: [String],
  category: { type: String, default: "Web App" },
  imageUrl: String,
  githubUrl: String,
  liveUrl: String,
  order: { type: Number, default: 999 },
  createdAt: { type: Date, default: Date.now }
});
const PortfolioProject = mongoose.model("PortfolioProject", portfolioProjectSchema);

const portfolioCertificationSchema = new mongoose.Schema({
  title: String,
  issuer: String,
  date: String,
  certificateUrl: String,
  imageUrl: String,
  analysisTitle: String,
  analysisText: String,
  active: { type: Boolean, default: true },
  order: { type: Number, default: 999 },
  createdAt: { type: Date, default: Date.now }
});
const PortfolioCertification = mongoose.model("PortfolioCertification", portfolioCertificationSchema);

const portfolioSkillSchema = new mongoose.Schema({
  name: String,
  category: { type: String, default: "Security" },
  level: { type: String, default: "Advanced" },
  icon: String,
  active: { type: Boolean, default: true },
  order: { type: Number, default: 999 },
  createdAt: { type: Date, default: Date.now }
});
const PortfolioSkill = mongoose.model("PortfolioSkill", portfolioSkillSchema);


function uploadAudioToCloudinary(fileBuffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "portfolio-music",
        public_id: originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_"),
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}


const loginAttempts = new Map();

const socFirewall = new Map();
const socEvents = [];
const manualBlockedIps = new Set();
let emergencyLockdown = false;

function addSocEvent(event) {
  socEvents.unshift({
    ...event,
    createdAt: new Date()
  });
  if (socEvents.length > 300) socEvents.pop();
}

const SOC_ADMIN_EMAIL = process.env.SOC_ADMIN_EMAIL || "naitik.infosec@gmail.com";
const SOC_CONTACT_EMAIL = "naitik.infosec@gmail.com";
const SOC_BLOCK_MS = 60 * 60 * 1000;

function isAdminProtectedIp(ip) {
  const safeIps = (process.env.ADMIN_SAFE_IPS || "")
    .split(",")
    .map((x) => cleanIp(x.trim()))
    .filter(Boolean);

  if (safeIps.includes(cleanIp(ip))) return true;

  if (process.env.NODE_ENV !== "production") {
    const devSafeIps = ["127.0.0.1", "::1", "localhost"];
    if (devSafeIps.includes(cleanIp(ip))) return true;
  }

  return false;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SANITIZE_ALLOWED_TAGS = ["strong", "em", "b", "i", "u", "br", "p", "ul", "ol", "li", "span"];
const SANITIZE_ALLOWED_ATTRS = {
  span: ["style", "class", "data-cyan"], strong: ["class"], em: ["class"],
  b: ["class"], i: ["class"], u: ["class"], p: ["class"], li: ["class"]
};

function sanitizeHtmlInput(html) {
  if (!html || typeof html !== "string") return html;
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<object[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed[\s\S]*?>/gi, "");
  out = out.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  out = out.replace(/<math[\s\S]*?<\/math>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<link[\s\S]*?>/gi, "");
  out = out.replace(/<meta[\s\S]*?>/gi, "");
  out = out.replace(/<form[\s\S]*?<\/form>/gi, "");
  out = out.replace(/<audio[\s\S]*?<\/audio>/gi, "");
  out = out.replace(/<video[\s\S]*?<\/video>/gi, "");
  out = out.replace(/<canvas[\s\S]*?<\/canvas>/gi, "");
  out = out.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\bhref\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi, "");
  out = out.replace(/\bsrc\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi, "");
  out = out.replace(/\bhref\s*=\s*(?:"[^"]*data:[^"]*"|'[^']*data:[^']*')/gi, "");
  out = out.replace(/\bsrc\s*=\s*(?:"[^"]*data:[^"]*"|'[^']*data:[^']*')/gi, "");
  out = out.replace(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (tag) => {
    const name = tag.match(/^<([a-zA-Z]+)/)[1].toLowerCase();
    if (!SANITIZE_ALLOWED_TAGS.includes(name)) return "";
    const m = tag.match(/^<([a-zA-Z]+)/);
    const allowed = SANITIZE_ALLOWED_ATTRS[name];
    if (!allowed) return tag.replace(/\s+[a-zA-Z-]+=(?:"[^"]*"|'[^']*')/g, "");
    return tag.replace(/\s+([a-zA-Z-]+)=(?:"[^"]*"|'[^']*')/g, (match, attr) =>
      allowed.includes(attr.toLowerCase()) ? match : ""
    );
  });
  return out;
}

function getMailTransporter() {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });
}

function nsaiSecurityMailTemplate({ title, severity, ip, reason, path, info = {}, blockedUntil }) {
  const rows = [
    ["IP Address", ip],
    ["Severity", severity],
    ["Reason", reason],
    ["Path", path || "Unknown"],
    ["Location", `${info.city || "Unknown"}, ${info.region || "Unknown"}, ${info.country || "Unknown"}`],
    ["ISP", info.isp || "Unknown"],
    ["Device", info.device || "Unknown"],
    ["OS", info.os || "Unknown"],
    ["Browser", info.browser || "Unknown"],
    ["User Agent", info.userAgent || "Unknown"],
    ["Blocked Until", blockedUntil ? new Date(blockedUntil).toLocaleString("en-IN") : "Not blocked"]
  ];

  return `
  <div style="margin:0;padding:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:760px;margin:0 auto;padding:28px">
      <div style="background:linear-gradient(135deg,#020617,#0f172a,#083344);border-radius:28px;padding:28px;color:#fff;box-shadow:0 25px 90px rgba(15,23,42,.25)">
        <p style="margin:0;color:#67e8f9;font-size:12px;font-weight:900;letter-spacing:5px">NS.ai SECURITY OPERATION CENTRE</p>
        <h1 style="margin:14px 0 8px;font-size:30px;line-height:1.1">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#cbd5e1;font-size:15px;font-weight:700">Sent by - NS.ai Security Operation Centre</p>
      </div>

      <div style="margin-top:18px;background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.9);border-radius:26px;padding:24px;box-shadow:0 20px 70px rgba(15,23,42,.12)">
        <div style="display:inline-block;background:${severity === "CRITICAL" ? "#fee2e2" : "#fef3c7"};color:${severity === "CRITICAL" ? "#dc2626" : "#b45309"};padding:10px 14px;border-radius:999px;font-weight:900;font-size:12px;letter-spacing:1px">${escapeHtml(severity)}</div>
        <h2 style="margin:18px 0 8px;font-size:22px">Suspicious activity detected</h2>
        <p style="margin:0;color:#475569;font-weight:700;line-height:1.7">${escapeHtml(reason)}</p>

        <table style="width:100%;margin-top:20px;border-collapse:separate;border-spacing:0 10px">
          ${rows.map(([k,v]) => `
          <tr>
            <td style="width:160px;background:#f8fafc;padding:14px;border-radius:14px 0 0 14px;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase">${escapeHtml(k)}</td>
            <td style="background:#f8fafc;padding:14px;border-radius:0 14px 14px 0;font-weight:800;word-break:break-word">${escapeHtml(v) || "Unknown"}</td>
          </tr>`).join("")}
        </table>

        <div style="margin-top:18px;background:#020617;color:#fff;border-radius:20px;padding:18px">
          <p style="margin:0;font-weight:900">Action Taken</p>
          <p style="margin:8px 0 0;color:#cbd5e1;font-weight:700">The IP has been temporarily suspended by NS.ai SOC. Contact: ${SOC_CONTACT_EMAIL}</p>
        </div>
      </div>

      <p style="text-align:center;margin-top:20px;color:#64748b;font-size:12px;font-weight:800">
        Developed by Naitik Soni • Stay Ethical, Stay Legal, Stay Secure
      </p>
    </div>
  </div>`;
}

async function sendNsaiSecurityAlert(payload) {
  try {
    const transporter = getMailTransporter();
    if (!transporter) {
      console.warn("⚠️  NS.ai SOC mail skipped: MAIL_USER / MAIL_PASS not configured in environment.");
      return;
    }

    await transporter.sendMail({
      from: `"NS.ai Security Operation Centre" <${process.env.MAIL_USER}>`,
      to: SOC_ADMIN_EMAIL,
      subject: `🚨 ${payload.severity} NS.ai SOC Alert - ${payload.ip} - ${new Date().toLocaleString("en-IN")}`,
      html: nsaiSecurityMailTemplate(payload)
    });

    console.log(`✅ NS.ai SOC alert sent → ${SOC_ADMIN_EMAIL} [${payload.severity}] IP: ${payload.ip}`);
  } catch (e) {
    // Non-fatal: email failure must never crash the security pipeline
    console.error(`❌ NS.ai SOC mail failed [${payload.severity}] IP: ${payload.ip} →`, e.message);
  }
}

function suspendedResponse(res, ip, reason = "Suspicious activity detected") {
  const safeIp = String(ip || "Unknown").replace(/[<>"'/]/g, "");
  const safeReason = String(reason || "Suspicious activity detected").replace(/[<>"'/]/g, "");

  return res.status(403).json({
    error: "Access Denied",
    reason: safeReason,
    ip: safeIp,
    message: "Your IP has been temporarily suspended. Contact the administrator."
  });
}

async function socMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 30 * 1000;
  const blockMs = SOC_BLOCK_MS;

  if (isAdminProtectedIp(ip)) {
    return next();
  }

  if (isDevelopmentOrigin(req)) {
    return next();
  }

  const authHeader = req.headers.authorization?.replace("Bearer ", "");
  if (authHeader) {
    try {
      jwt.verify(authHeader, process.env.JWT_SECRET);
      return next();
    } catch {}
  }

  if (manualBlockedIps.has(ip)) {
    addSocEvent({ type: "MANUAL_BLOCKED", severity: "HIGH", ip, path: req.path, reason: "IP manually blocked by admin" });
    return res.status(429).json({ error: "NS.ai SOC Firewall: IP blocked by admin." });
  }

  const item = socFirewall.get(ip) || {
    hits: [],
    blockedUntil: null,
    score: 0
  };

  if (item.blockedUntil && now < item.blockedUntil) {
    addSocEvent({
      type: "AUTO_BLOCKED",
      severity: "HIGH",
      ip,
      path: req.path,
      reason: "Blocked by NS.ai SOC firewall"
    });

    return suspendedResponse(res, ip, "Your IP is temporarily suspended by NS.ai SOC firewall.");
  }

  item.hits = item.hits.filter((t) => now - t < windowMs);
  item.hits.push(now);

  const hits = item.hits.length;

  const blockLimit = emergencyLockdown ? 25 : 50;
  const highLimit = emergencyLockdown ? 15 : 35;
  const mediumLimit = emergencyLockdown ? 8 : 20;

  if (hits >= blockLimit) {
    item.blockedUntil = now + blockMs;
    item.score = 100;

    addSocEvent({
      type: "POSSIBLE_DOS",
      severity: "CRITICAL",
      ip,
      path: req.path,
      reason: `${hits} requests in 30 seconds`
    });

    socFirewall.set(ip, item);

    const blockedUntil = new Date(item.blockedUntil);

    await BlockedIP.findOneAndUpdate(
      { ip },
      {
        ip,
        reason: `${hits} requests in 30 seconds`,
        expiresAt: blockedUntil,
        blockedBy: "NS.ai SOC",
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    await SecurityLog.create({
      ip,
      action: "AUTO_BLOCKED_TRAFFIC",
      reason: `${hits} requests in 30 seconds`,
      attempts: hits,
      blockedUntil,
      userAgent: req.headers["user-agent"] || "",
      ...(await getSecurityContext(req, ip, "AUTO_BLOCK"))
    });

    await sendNsaiSecurityAlert({
      title: "Automatic Traffic Block Activated",
      severity: "CRITICAL",
      ip,
      reason: `${hits} requests detected in 30 seconds. IP blocked for 1 hour.`,
      path: req.path,
      blockedUntil,
      info: await getSecurityContext(req, ip, "AUTO_BLOCK")
    });

    return suspendedResponse(res, ip, `${hits} requests in 30 seconds`);
    
  }

  if (hits >= highLimit) {
    item.score = 80;
    addSocEvent({
      type: "TRAFFIC_SPIKE",
      severity: "HIGH",
      ip,
      path: req.path,
      reason: `${hits} requests in 30 seconds`
    });
  } else if (hits >= mediumLimit) {
    item.score = 55;
    addSocEvent({
      type: "SUSPICIOUS_TRAFFIC",
      severity: "MEDIUM",
      ip,
      path: req.path,
      reason: `${hits} requests in 30 seconds`
    });
  }

  socFirewall.set(ip, item);
  next();
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return socMiddleware(req, res, next);
  next();
});



function getClientIp(req) {
  const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
  return cleanIp(forwardedIp || req.clientIp || req.ip);
}

function isDevelopmentOrigin(req) {
  if (process.env.NODE_ENV === "production") return false;
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  return origin.includes("localhost") || origin.includes("127.0.0.1") ||
         referer.includes("localhost") || referer.includes("127.0.0.1");
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
  adminProfile: {
    name: { type: String, default: "Naitik Soni" },
    email: { type: String, default: "naitik.infosec@gmail.com" },
    role: { type: String, default: "Portfolio Owner / Cybersecurity Admin" }
  },
  reportSettings: {
    enabled: { type: Boolean, default: true },
    reportEmail: { type: String, default: "naitik.infosec@gmail.com" },
    reportTime: { type: String, default: "21:00" }
  },
  nsaiSettings: {
    language: { type: String, default: "Hinglish" },
    tone: { type: String, default: "Professional" },
    voice: { type: Boolean, default: true }
  },
  alertSettings: {
    failedLoginAlerts: { type: Boolean, default: true },
    messageAlerts: { type: Boolean, default: true },
    visitorAlerts: { type: Boolean, default: true }
  },
  themeSettings: {
    accent: { type: String, default: "cyan" },
    glass: { type: Boolean, default: true }
  },
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

async function blockGuard(req, res, next) {
  try {
    const ip = getClientIp(req);

    // FIX: Admin IPs in ADMIN_SAFE_IPS are never blocked by the firewall.
    if (isAdminProtectedIp(ip)) return next();

    // FIX: Localhost development requests bypass the block check entirely.
    if (isDevelopmentOrigin(req)) return next();

    // FIX: Authenticated admin sessions (valid JWT) bypass the block check.
    // This ensures an admin can never be locked out of their own panel.
    const authHeader = req.headers.authorization?.replace("Bearer ", "");
    if (authHeader) {
      try {
        jwt.verify(authHeader, process.env.JWT_SECRET);
        return next(); // Valid admin token — bypass block check entirely
      } catch { /* Invalid or expired token — fall through to block check */ }
    }

    const blocked = await BlockedIP.findOne({ ip });

    if (blocked) {
      if (blocked.expiresAt && new Date(blocked.expiresAt) < new Date()) {
        await BlockedIP.deleteOne({ ip });
        return next();
      }

      return suspendedResponse(res, ip, blocked.reason || "Blocked by NS.ai SOC");
    }
  } catch (err) {
    console.error("blockGuard error:", err.message);
  }
  next();
}

app.use("/api", blockGuard);

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
  if (!ip) return "";
  // Strip IPv4-mapped IPv6 prefix (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
  ip = ip.replace(/^::ffff:/i, "").trim();
  // Normalize IPv6 loopback
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "localhost" || ip === "::1") return true;
  // RFC1918 private ranges
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // Carrier-grade NAT
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  // Link-local
  if (/^169\.254\./.test(ip)) return true;
  return false;
}

// ─── Unified, robust geolocation function ───────────────────────────────────
// Single source of truth — replaces the old getGeo() and lookupIpGeo().
// Priority: ip-api.com (45/min free) → ipwho.is → ipapi.co
// All fetches have a 4-second timeout so cold-start latency can't hang a route.
async function getGeo(ip) {
  const fallback = {
    city: "Unknown",
    region: "Unknown",
    country: "Unknown",
    countryCode: "",
    isp: "Unknown",
    lat: null,
    lng: null
  };

  // Localhost / dev mode
  if (!ip || ip === "127.0.0.1" || ip === "localhost") {
    return { city: "Vadodara", region: "Gujarat", country: "India", countryCode: "IN", isp: "Localhost", lat: 22.3072, lng: 73.1812 };
  }

  // Any private/internal IP (Render container IPs, Docker, etc.) → return fallback
  // Don't waste an API call on a private address — it will always fail.
  if (isPrivateIp(ip)) {
    console.warn(`[GEO] Private/internal IP detected: ${ip} — skipping geo lookup`);
    return fallback;
  }

  // Helper: fetch with timeout
  async function fetchWithTimeout(url, ms = 4000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ── 1. ip-api.com (primary — reliable, no key, 45 req/min free) ──────────
  try {
    const r = await fetchWithTimeout(
      `http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,countryCode,isp,org,lat,lon`,
      4000
    );
    if (r.ok) {
      const d = await r.json();
      if (d.status === "success") {
        return {
          city: d.city || "Unknown",
          region: d.regionName || "Unknown",
          country: d.country || "Unknown",
          countryCode: d.countryCode || "",
          isp: d.isp || d.org || "Unknown",
          lat: d.lat || null,
          lng: d.lon || null
        };
      }
      console.warn(`[GEO] ip-api.com returned non-success for ${ip}: ${d.message}`);
    }
  } catch (e) {
    console.warn(`[GEO] ip-api.com failed for ${ip}: ${e.message}`);
  }

  // ── 2. ipwho.is (fallback) ────────────────────────────────────────────────
  try {
    const r = await fetchWithTimeout(`https://ipwho.is/${ip}`, 4000);
    if (r.ok) {
      const d = await r.json();
      // Check d.success === true explicitly — undefined !== true
      if (d.success === true && d.city) {
        return {
          city: d.city || "Unknown",
          region: d.region || "Unknown",
          country: d.country || "Unknown",
          countryCode: d.country_code || "",
          isp: d.connection?.isp || d.connection?.org || "Unknown",
          lat: d.latitude || null,
          lng: d.longitude || null
        };
      }
    }
  } catch (e) {
    console.warn(`[GEO] ipwho.is failed for ${ip}: ${e.message}`);
  }

  // ── 3. ipapi.co (last resort) ─────────────────────────────────────────────
  try {
    const r = await fetchWithTimeout(`https://ipapi.co/${ip}/json/`, 4000);
    if (r.ok) {
      const d = await r.json();
      if (!d.error && d.city) {
        return {
          city: d.city || "Unknown",
          region: d.region || "Unknown",
          country: d.country_name || d.country || "Unknown",
          countryCode: d.country_code || "",
          isp: d.org || d.network || "Unknown",
          lat: d.latitude || null,
          lng: d.longitude || null
        };
      }
    }
  } catch (e) {
    console.warn(`[GEO] ipapi.co failed for ${ip}: ${e.message}`);
  }

  return fallback;
}
// Alias for backward compat — both names now point to the same function.
const lookupIpGeo = getGeo;
// ─────────────────────────────────────────────────────────────────────────────



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

app.post("/api/music/play", async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.body.trackId).lean();
    if (!track) return res.status(404).json({ error: "Track not found" });

    const userAgent = req.body.userAgent || req.headers["user-agent"] || "";
    const bodyPublicIp = req.body.publicIp ? cleanIp(req.body.publicIp) : null;
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const ip = bodyPublicIp || cleanIp(forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    await MusicPlay.create({
      trackId: track._id,
      title: track.title,
      ip,
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode || "",
      browser: ua.browser?.name || "Unknown",
      os: ua.os?.name || "Unknown",
      device: ua.device?.type || "Desktop",
      page: req.body.page || "/",
      userAgent
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Music play tracking failed:", err.message);
    res.status(500).json({ error: "Music play tracking failed" });
  }
});

app.get("/api/music/tracks", async (req, res) => {
  try {
    const tracks = await MusicTrack.find({ active: true }).sort({ featured: -1, sortOrder: 1, createdAt: 1 }).lean();

    res.json({
      success: true,
      tracks: tracks.map((t) => ({
        id: t._id,
        _id: t._id,
        title: t.title,
        url: t.url,
        createdAt: t.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Music tracks load failed" });
  }
});

app.get("/api/admin/music/analytics", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalTracks = await MusicTrack.countDocuments();
    const activeTracks = await MusicTrack.countDocuments({ active: true });
    const totalPlays = await MusicPlay.countDocuments();
    const todayPlays = await MusicPlay.countDocuments({ createdAt: { $gte: today } });

    const mostPlayed = await MusicPlay.aggregate([
      { $group: { _id: "$trackId", title: { $last: "$title" }, plays: { $sum: 1 } } },
      { $sort: { plays: -1 } },
      { $limit: 1 }
    ]);

    const topTracks = await MusicPlay.aggregate([
      { $group: { _id: "$trackId", title: { $last: "$title" }, plays: { $sum: 1 } } },
      { $sort: { plays: -1 } },
      { $limit: 8 }
    ]);

    const recentPlays = await MusicPlay.find().sort({ createdAt: -1 }).limit(10).lean();

    res.json({
      success: true,
      totalTracks,
      activeTracks,
      totalPlays,
      todayPlays,
      mostPlayed: mostPlayed[0] || null,
      topTracks,
      recentPlays
    });
  } catch (err) {
    res.status(500).json({ error: "Music analytics failed" });
  }
});

app.get("/api/admin/music/tracks", auth, async (req, res) => {
  try {
    const tracks = await MusicTrack.find().sort({ featured: -1, sortOrder: 1, createdAt: -1 }).lean();
    res.json({ success: true, total: tracks.length, tracks });
  } catch (err) {
    res.status(500).json({ error: "Admin music tracks load failed" });
  }
});

app.post("/api/admin/music/upload", auth, upload.single("song"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
    const result = await uploadAudioToCloudinary(req.file.buffer, req.file.originalname);

    const track = await MusicTrack.create({
      title,
      url: result.secure_url,
      publicId: result.public_id,
      size: req.file.size,
      format: result.format,
      active: true,
      sortOrder: await MusicTrack.countDocuments() + 1
    });

    res.json({ success: true, track });
  } catch (err) {
    console.error("Music upload failed:", err.message);
    res.status(500).json({ error: "Music upload failed" });
  }
});

app.patch("/api/admin/music/tracks/:id", auth, async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.title === "string") allowed.title = req.body.title.trim() || "Untitled Track";
    if (typeof req.body.active === "boolean") allowed.active = req.body.active;
    if (typeof req.body.featured === "boolean") allowed.featured = req.body.featured;
    if (typeof req.body.sortOrder === "number") allowed.sortOrder = req.body.sortOrder;

    const track = await MusicTrack.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { new: true }
    );

    if (!track) return res.status(404).json({ error: "Track not found" });

    if (allowed.featured === true) {
      await MusicTrack.updateMany(
        { _id: { $ne: track._id } },
        { $set: { featured: false } }
      );
    }

    res.json({ success: true, track });
  } catch (err) {
    res.status(500).json({ error: "Track update failed" });
  }
});

app.post("/api/admin/music/reorder", auth, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    await Promise.all(
      items.map((item, index) =>
        MusicTrack.updateOne(
          { _id: item.id },
          { $set: { sortOrder: Number(item.sortOrder ?? index + 1) } }
        )
      )
    );

    const tracks = await MusicTrack.find().sort({ featured: -1, sortOrder: 1, createdAt: -1 }).lean();
    res.json({ success: true, tracks });
  } catch (err) {
    res.status(500).json({ error: "Track reorder failed" });
  }
});

app.delete("/api/admin/music/tracks/:id", auth, async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.params.id);
    if (!track) return res.status(404).json({ error: "Track not found" });

    if (track.publicId) {
      try {
        await cloudinary.uploader.destroy(track.publicId, { resource_type: "video" });
      } catch (e) {
        console.log("Cloudinary delete warning:", e.message);
      }
    }

    await MusicTrack.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Track delete failed" });
  }
});


app.get("/", (req, res) => {
  res.send("Portfolio Admin Backend Running");
});


app.get("/api/security/check", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const blocked = await BlockedIP.findOne({ ip });

    if (blocked) {
      if (blocked.expiresAt && new Date(blocked.expiresAt) < new Date()) {
        await BlockedIP.deleteOne({ ip });
        return res.json({ blocked: false });
      }

      return res.status(403).json({
        blocked: true,
        ip,
        reason: blocked.reason,
        expiresAt: blocked.expiresAt,
        contact: "naitik.infosec@gmail.com"
      });
    }

    res.json({ blocked: false, ip });
  } catch {
    res.json({ blocked: false });
  }
});


app.get("/api/test-suspended-page", (req, res) => {
  return suspendedResponse(res, req.query.ip || "88.88.88.88", "Demo suspended page preview");
});

app.post("/api/track", async (req, res) => {
  try {
    const bodyPublicIp = req.body.publicIp ? cleanIp(req.body.publicIp) : null;
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const rawIp = bodyPublicIp || cleanIp(forwardedIp || "") || cleanIp(req.clientIp || "") || cleanIp(req.ip || "");
    const ip = cleanIp(rawIp);

    if (!rateLimitCheck(trackRateLimit, ip, 1 * 60 * 1000, 30)) {
      return res.status(429).json({ success: false, error: "Rate limited" });
    }

    let geo = await getGeo(ip);
    let geoProvider = geo.country !== "Unknown" ? "ip-api.com" : "none";


    const uaString = req.body.userAgent || req.headers["user-agent"] || "";
    const parser = new UAParser(uaString);
    const uaResult = parser.getResult();

    const browserName = uaResult.browser?.name || req.body.browser || "Unknown";
    const browserVersion = uaResult.browser?.version ? ` ${uaResult.browser.version.split(".")[0]}` : "";
    const osName = uaResult.os?.name || req.body.os || "Unknown";
    const osVersion = uaResult.os?.version ? ` ${uaResult.os.version}` : "";
    const deviceType = uaResult.device?.type
      ? uaResult.device.type.charAt(0).toUpperCase() + uaResult.device.type.slice(1)
      : (req.body.device || "Desktop");

    await Visitor.create({
      ip,
      visitorId: req.body.visitorId || ip,
      page: req.body.page || "/",
      sessionId: req.body.sessionId || "",
      sessionDuration: req.body.sessionDuration || 0,
      pagesViewed: (req.body.pagesViewed || []).slice(0, 50),
      screen: req.body.screen || "",
      language: req.body.language || "",
      timezone: req.body.timezone || "",
      referrer: req.body.referrer || "",
      city: req.body.city || geo.city || "Unknown",
      region: req.body.region || geo.region || "Unknown",
      country: req.body.country || geo.country || "Unknown",
      countryCode: geo.countryCode || "",
      isp: req.body.isp || geo.isp || "Unknown",
      lat: req.body.lat || geo.lat || null,
      lng: req.body.lng || geo.lng || null,
      browser: `${browserName}${browserVersion}`,
      os: `${osName}${osVersion}`,
      device: deviceType,
      userAgent: uaString,
      createdAt: new Date()
    });

    res.json({ success: true, ip, geoProvider, location: geo });
  } catch (err) {
    console.log("Tracking error:", err.message);
    res.status(500).json({ error: "Tracking failed" });
  }
});




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
    countryCode: geo.countryCode || "",
    isp: geo.isp || "Unknown",
    lat: geo.lat || null,
    lng: geo.lng || null,
    browser,
    os,
    device,
  };
}



app.get("/api/admin/test-soc-mail", auth, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const info = await getSecurityContext(req, ip, "TEST_SOC_MAIL");

    await sendNsaiSecurityAlert({
      title: "NS.ai SOC Test Alert",
      severity: "HIGH",
      ip,
      reason: "This is a test alert to verify NS.ai Security Operation Centre email delivery.",
      path: "/api/admin/test-soc-mail",
      blockedUntil: null,
      info
    });

    res.json({ success: true, message: "Test SOC email sent", to: SOC_ADMIN_EMAIL });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post("/api/admin/login", async (req, res) => {
  try {
    const { key } = req.body;
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] || "";
    const sec = await getSecurityContext(req, ip, key);

    if (isBlocked(ip)) {
      const item = loginAttempts.get(ip);
      return suspendedResponse(res, ip, "Admin access temporarily suspended due to repeated failed login attempts.");
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

      if (blockedUntil && !isAdminProtectedIp(ip)) {
        const blockedDate = new Date(blockedUntil);

        await BlockedIP.findOneAndUpdate(
          { ip },
          {
            ip,
            reason: `Admin brute-force protection: ${count} failed login attempts`,
            expiresAt: blockedDate,
            blockedBy: "NS.ai SOC",
            createdAt: new Date()
          },
          { upsert: true, new: true }
        );

        addSocEvent({
          type: "ADMIN_BRUTE_FORCE",
          severity: "CRITICAL",
          ip,
          path: "/api/admin/login",
          reason: `${count} failed admin login attempts`
        });

        sendNsaiSecurityAlert({
          title: "Admin Panel Brute Force Blocked",
          severity: "CRITICAL",
          ip,
          reason: `${count} failed admin login attempts detected. IP blocked for 1 hour.`,
          path: "/api/admin/login",
          blockedUntil: blockedDate,
          info: sec
        });

        return suspendedResponse(res, ip, "Admin brute-force attempt detected.");
      }

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
    const bodyPublicIp = req.body.publicIp ? cleanIp(req.body.publicIp) : null;
    const ip = bodyPublicIp || getClientIp(req);

    if (!rateLimitCheck(contactRateLimit, ip, 5 * 60 * 1000, 10)) {
      return res.status(429).json({ success: false, error: "Too many messages. Please wait." });
    }

    const geo = await getGeo(ip);


    const ua = req.headers["user-agent"] || req.body.userAgent || "";
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const browser = result.browser?.name || req.body.browser || "Unknown";
    const os = result.os?.name || req.body.os || "Unknown";
    const device = result.device?.type || "Desktop";

    const msg = await Message.create({
      name: sanitizeHtmlInput(req.body.name || "Unknown"),
      email: req.body.email || "Unknown",
      message: sanitizeHtmlInput(req.body.message || ""),
      ip,
      city: geo.city || "Unknown",
      region: geo.region || "Unknown",
      country: geo.country || "Unknown",
      countryCode: geo.countryCode || "",
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



app.post("/api/resume-download", async (req, res) => {
  try {
    const userAgent = req.body.userAgent || req.headers["user-agent"] || "";
    // FIX: Prefer publicIp sent by the frontend (real visitor IP from api.ipify.org)
    const bodyPublicIp = req.body.publicIp ? cleanIp(req.body.publicIp) : null;
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const ip = bodyPublicIp || cleanIp(forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    const item = await ResumeDownload.create({
      ip,
      publicIp: ip,
      page: req.body.page || "/",
      city: geo.city || "Unknown",
      region: geo.region || "Unknown",
      country: geo.country || "Unknown",
      countryCode: geo.countryCode || "",
      isp: geo.isp || "Unknown",
      lat: geo.lat || null,
      lng: geo.lng || null,
      browser: ua.browser?.name || "Unknown",
      os: ua.os?.name || "Unknown",
      device: ua.device?.type || "Desktop",
      userAgent
    });

    res.json({ success: true, download: item });
  } catch (err) {
    res.status(500).json({ error: "Resume download tracking failed" });
  }
});


app.get("/api/admin/resume-downloads", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = await ResumeDownload.countDocuments();
    const todayCount = await ResumeDownload.countDocuments({ createdAt: { $gte: today } });
    const recent = await ResumeDownload.find().sort({ createdAt: -1 }).limit(100).lean();

    const countries = await ResumeDownload.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const cities = await ResumeDownload.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    res.json({ total, todayCount, recent, countries, cities });
  } catch {
    res.status(500).json({ error: "Resume downloads fetch failed" });
  }
});

app.get("/api/admin/dashboard", auth, async (req, res) => {
  try {
    const totalVisitors = await Visitor.countDocuments();
    const totalMessages = await Message.countDocuments();
    const unreadMessages = await Message.countDocuments({ status: "Unread" });

    // India timezone today start (midnight IST)
    const now = new Date();
    const indiaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    indiaNow.setHours(0, 0, 0, 0);

    const todayStart = new Date(indiaNow.getTime() - 5.5 * 60 * 60 * 1000);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // 1. TODAY VIEWS & TREND (Today vs Yesterday)
    const todayViews = await Visitor.countDocuments({ createdAt: { $gte: todayStart } });
    const yesterdayViews = await Visitor.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart } });
    const todayViewsTrend = yesterdayViews > 0 
      ? Number((((todayViews - yesterdayViews) / yesterdayViews) * 100).toFixed(1))
      : (todayViews > 0 ? 100 : null);

    // 2. ACTIVE SESSIONS & TREND (Last 30m vs 30m-60m ago)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeSessions = await Visitor.countDocuments({ createdAt: { $gte: thirtyMinAgo } });
    const prevActiveSessions = await Visitor.countDocuments({ createdAt: { $gte: sixtyMinAgo, $lt: thirtyMinAgo } });
    const activeSessionsTrend = prevActiveSessions > 0
      ? Number((((activeSessions - prevActiveSessions) / prevActiveSessions) * 100).toFixed(1))
      : (activeSessions > 0 ? 100 : null);

    // 3. TOTAL VISITORS TREND (Last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const currentWeekVisitors = await Visitor.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const prevWeekVisitors = await Visitor.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } });
    const totalVisitorsTrend = prevWeekVisitors > 0
      ? Number((((currentWeekVisitors - prevWeekVisitors) / prevWeekVisitors) * 100).toFixed(1))
      : (currentWeekVisitors > 0 ? 100 : null);

    // 4. MESSAGES TREND (Messages today vs yesterday)
    const todayMessages = await Message.countDocuments({ createdAt: { $gte: todayStart } });
    const yesterdayMessages = await Message.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart } });
    const messagesTrend = yesterdayMessages > 0
      ? Number((((todayMessages - yesterdayMessages) / yesterdayMessages) * 100).toFixed(1))
      : (todayMessages > 0 ? 100 : null);

    // 5. GUARANTEED 7-DAY DAILY VIEWS ARRAY (Filling missing days with 0)
    const rawDailyViews = await Visitor.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%d/%m", date: "$createdAt" } }, views: { $sum: 1 } } }
    ]);
    const dailyMap = new Map(rawDailyViews.map(d => [d._id, d.views]));

    const rawDailyMessages = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%d/%m", date: "$createdAt" } }, count: { $sum: 1 } } }
    ]);
    const messageMap = new Map(rawDailyMessages.map(m => [m._id, m.count]));

    const dailyViews = [];
    const sparklineTotalVisitors = [];
    const sparklineTodayViews = [];
    const sparklineMessages = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }).replace(/\//g, "/");
      const viewsCount = dailyMap.get(dayStr) || 0;
      const msgCount = messageMap.get(dayStr) || 0;

      dailyViews.push({ date: dayStr, views: viewsCount });
      sparklineTotalVisitors.push(viewsCount);
      sparklineTodayViews.push(viewsCount);
      sparklineMessages.push(msgCount);
    }

    // Sparkline for active sessions over last 6 intervals (4h slots in 24h)
    const rawActiveSlots = [];
    for (let i = 5; i >= 0; i--) {
      const slotStart = new Date(Date.now() - (i + 1) * 4 * 60 * 60 * 1000);
      const slotEnd = new Date(Date.now() - i * 4 * 60 * 60 * 1000);
      const slotCount = await Visitor.countDocuments({ createdAt: { $gte: slotStart, $lt: slotEnd } });
      rawActiveSlots.push(slotCount);
    }

    const recentVisitorsRaw = await Visitor.find().sort({ createdAt: -1 }).limit(50);
    const messages = await Message.find().sort({ createdAt: -1 }).limit(20);

    const visitorIds = recentVisitorsRaw.map(v => v.visitorId || v.ip);
    const visitCounts = await Visitor.aggregate([
      { $match: { visitorId: { $in: visitorIds } } },
      { $group: { _id: "$visitorId", visits: { $sum: 1 } } }
    ]);
    const visitCountMap = new Map(visitCounts.map(v => [v._id, v.visits]));

    const recentVisitors = recentVisitorsRaw.map((v) => {
      const visits = visitCountMap.get(v.visitorId || v.ip) || 1;
      const obj = v.toObject();
      obj.visits = visits;
      obj.isReturning = visits > 1;
      return obj;
    });

    const topPages = await Visitor.aggregate([{ $group: { _id: "$page", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]);
    const browsers = await Visitor.aggregate([{ $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const rawDevices = await Visitor.aggregate([{ $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const osStats = await Visitor.aggregate([{ $group: { _id: "$os", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

    const devices = rawDevices.map(d => ({
      name: d._id || "Unknown",
      value: d.count
    }));

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

    const securityLogs = socEvents.slice(0, 50).map((e) => ({
      ip: e.ip,
      action: e.action,
      reason: e.reason,
      attemptedKey: e.attemptedKey,
      location: e.location || "Unknown",
      device: e.device || "Unknown",
      attempts: e.attempts || 1,
      severity: e.severity || "LOW",
      createdAt: e.timestamp || new Date().toISOString()
    }));

    let resumeDownloads = [];
    try {
      resumeDownloads = await ResumeDownload.find().sort({ createdAt: -1 }).limit(50).lean();
    } catch {}

    res.json({
      totalVisitors,
      todayViews,
      activeSessions,
      totalMessages,
      unreadMessages,
      trends: {
        totalVisitors: totalVisitorsTrend,
        todayViews: todayViewsTrend,
        activeSessions: activeSessionsTrend,
        messages: messagesTrend
      },
      sparklines: {
        totalVisitors: sparklineTotalVisitors,
        todayViews: sparklineTodayViews,
        activeSessions: rawActiveSlots,
        messages: sparklineMessages
      },
      recentVisitors,
      messages,
      topPages,
      browsers,
      devices,
      osStats,
      countries,
      cities,
      dailyViews,
      securityLogs,
      resumeDownloads
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ error: "Dashboard data fetch failed" });
  }
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


app.post("/api/admin/messages/:id/reply", auth, async (req, res) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({
        error: "Email service not configured",
        details: "RESEND_API_KEY is not set. Add it to your Render environment variables.",
        code: "RESEND_NOT_CONFIGURED",
      });
    }

    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      return res.status(400).json({ error: "Reply message is required" });
    }

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:28px">
        <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:24px;padding:28px;border:1px solid #e2e8f0">
          <h2 style="margin:0;color:#020617">Reply from Naitik Soni</h2>
          <p style="color:#64748b">Cybersecurity Engineer | Ethical Hacker</p>
          <div style="margin-top:22px;padding:20px;border-radius:18px;background:#f1f5f9;color:#0f172a;line-height:1.7">
            ${escapeHtml(reply).replace(/\n/g, "<br/>")}
          </div>
          <p style="margin-top:24px;color:#64748b;font-size:13px">
            Original message from ${escapeHtml(msg.name) || "visitor"} was received through Naitik Soni Portfolio.
          </p>
        </div>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Naitik Soni <onboarding@resend.dev>",
        to: msg.email,
        subject: "Reply from Naitik Soni",
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend reply failed:", emailData);
      return res.status(500).json({
        error: "Reply email failed",
        details: emailData?.message || emailData?.error || JSON.stringify(emailData),
      });
    }

    msg.status = "Replied";
    msg.reply = reply;
    msg.repliedAt = new Date();
    await msg.save();

    res.json({ success: true, message: "Reply sent successfully" });
  } catch (err) {
    console.error("Reply email failed:", err);
    res.status(500).json({ error: "Reply email failed" });
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
    if (!newKey || typeof newKey !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    const trimmed = newKey.trim();

    if (trimmed.length < 12) {
      return res.status(400).json({ error: "Password must be at least 12 characters" });
    }
    if (trimmed.length > 128) {
      return res.status(400).json({ error: "Password must not exceed 128 characters" });
    }
    if (!/[A-Z]/.test(trimmed)) {
      return res.status(400).json({ error: "Password must contain at least one uppercase letter" });
    }
    if (!/[a-z]/.test(trimmed)) {
      return res.status(400).json({ error: "Password must contain at least one lowercase letter" });
    }
    if (!/[0-9]/.test(trimmed)) {
      return res.status(400).json({ error: "Password must contain at least one number" });
    }
    if (!/[^A-Za-z0-9]/.test(trimmed)) {
      return res.status(400).json({ error: "Password must contain at least one special character" });
    }
    if (/^\s+$/.test(trimmed)) {
      return res.status(400).json({ error: "Password must not be whitespace only" });
    }
    if (/(.)\1{2,}/.test(trimmed)) {
      return res.status(400).json({ error: "Password must not contain 3+ repeated characters" });
    }
    if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(trimmed)) {
      return res.status(400).json({ error: "Password must not start with a sequential pattern" });
    }
    const lower = trimmed.toLowerCase();
    const weakPasswords = ["password", "letmein", "welcome", "admin", "changeme", "master", "qwerty", "login", "passw0rd"];
    if (weakPasswords.some((w) => lower.includes(w))) {
      return res.status(400).json({ error: "Password is too common. Choose a stronger password" });
    }

    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ adminKey: trimmed });
    } else {
      setting.adminKey = trimmed;
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


app.get("/api/admin/settings", auth, async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});
  const obj = setting.toObject();
  delete obj.adminKey;
  res.json(obj);
});

app.patch("/api/admin/settings", auth, async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = await Setting.create({});

    const allowed = ["adminProfile", "reportSettings", "nsaiSettings", "alertSettings", "themeSettings"];

    for (const key of allowed) {
      if (req.body[key] && typeof req.body[key] === "object") {
        setting[key] = { ...(setting[key]?.toObject?.() || setting[key] || {}), ...req.body[key] };
      }
    }

    setting.adminLogs.push({
      action: "Settings updated",
      ip: req.ip
    });

    setting.updatedAt = new Date();
    await setting.save();

    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ error: "Settings update failed" });
  }
});

app.delete("/api/admin/reset-data", auth, async (req, res) => {
  try {
    const confirm = req.body?.confirm;
    if (confirm !== "RESET DATA") {
      return res.status(400).json({ error: "Confirmation text mismatch" });
    }

    await Visitor.deleteMany({});
    await Message.deleteMany({});
    await SecurityLog.deleteMany({});

    let setting = await Setting.findOne();
    if (!setting) setting = await Setting.create({});
    setting.adminLogs.push({
      action: "DANGER: Admin reset analytics/messages/security data",
      ip: req.ip
    });
    setting.updatedAt = new Date();
    await setting.save();

    res.json({ success: true, message: "All analytics, messages and security logs cleared" });
  } catch {
    res.status(500).json({ error: "Reset data failed" });
  }
});

app.delete("/api/admin/visitors", auth, async (req, res) => {
  await Visitor.deleteMany({});
  res.json({ success: true });
});

app.delete("/api/admin/messages", auth, async (req, res) => {
  await Message.deleteMany({});
  res.json({ success: true });
});




app.get("/api/admin/digital-twins", auth, async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(800).lean();

    const groups = {};
    visitors.forEach((v) => {
      const ip = v.ip || "Unknown";
      if (!groups[ip]) {
        groups[ip] = {
          ip,
          city: v.city || "Unknown",
          country: v.country || "Unknown",
          browser: v.browser || "Unknown",
          os: v.os || "Unknown",
          device: v.device || "Unknown",
          pages: [],
          visits: 0,
          firstSeen: v.createdAt,
          lastSeen: v.createdAt,
        };
      }

      groups[ip].visits += 1;
      groups[ip].pages.push(v.page || "/");
      if (new Date(v.createdAt) > new Date(groups[ip].lastSeen)) groups[ip].lastSeen = v.createdAt;
      if (new Date(v.createdAt) < new Date(groups[ip].firstSeen)) groups[ip].firstSeen = v.createdAt;
    });

    const twins = Object.values(groups).map((g) => {
      const pageText = g.pages.join(" ").toLowerCase();
      const uniquePages = [...new Set(g.pages)];

      let recruiter = 0;
      let client = 0;
      let learner = 0;
      let threat = 0;

      if (pageText.includes("about")) recruiter += 20;
      if (pageText.includes("skill")) recruiter += 20;
      if (pageText.includes("experience")) recruiter += 25;
      if (pageText.includes("resume")) recruiter += 45;
      if (pageText.includes("contact")) recruiter += 25;
      if (uniquePages.length >= 3) recruiter += 15;
      if (g.visits >= 3) recruiter += 10;

      if (pageText.includes("project")) client += 40;
      if (pageText.includes("service")) client += 30;
      if (pageText.includes("contact")) client += 30;
      if (uniquePages.length >= 3) client += 15;
      if (g.visits >= 4) client += 15;

      if (pageText.includes("project")) learner += 20;
      if (pageText.includes("certificate")) learner += 20;
      if (pageText.includes("blog")) learner += 20;
      if (pageText.includes("cyber")) learner += 25;

      if (pageText.includes("admin")) threat += 35;
      if (g.visits >= 20) threat += 35;
      if (g.visits >= 40) threat += 60;

      recruiter = Math.min(99, recruiter);
      client = Math.min(99, client);
      learner = Math.min(99, learner);
      threat = Math.min(99, threat);

      const engagementScore = Math.min(100, uniquePages.length * 15 + Math.min(40, g.visits * 4));

      let intent = "Normal Visitor";
      let confidence = Math.max(recruiter, client, learner, threat, engagementScore);

      if (threat >= 55) intent = "Suspicious User";
      else if (recruiter >= client && recruiter >= learner && recruiter >= 35) intent = "Recruiter";
      else if (client >= recruiter && client >= learner && client >= 35) intent = "Potential Client";
      else if (learner >= 45) intent = "Cybersecurity Learner";
      else if (engagementScore >= 65) intent = "High Engagement Visitor";

      const heat =
        threat >= 55 ? "Risk" :
        engagementScore >= 80 || recruiter >= 65 || client >= 65 ? "Hot" :
        engagementScore >= 45 ? "Warm" : "Cold";

      const recommendation =
        intent === "Recruiter" ? "High-value recruiter signal. Keep portfolio resume and experience section polished." :
        intent === "Potential Client" ? "Potential client detected. Follow up if contact message appears." :
        intent === "Suspicious User" ? "Suspicious behavior detected. Monitor this IP in SOC Panel." :
        intent === "Cybersecurity Learner" ? "Learning-focused visitor. Projects and certificates are attracting attention." :
        "Normal visitor behavior. Continue monitoring.";

      return {
        ...g,
        pages: uniquePages.slice(0, 8),
        scores: { recruiter, client, learner, threat, engagement: engagementScore },
        intent,
        confidence,
        heat,
        recommendation,
      };
    }).sort((a, b) => {
      const timeDiff = new Date(b.lastSeen) - new Date(a.lastSeen);
      if (timeDiff !== 0) return timeDiff;
      return b.confidence - a.confidence;
    });

    const allTwins = twins;
    const visibleTwins = allTwins.slice(0, 50);
    const total = allTwins.length || 1;
    const hotLeads = allTwins.filter((x) => x.heat === "Hot").length;
    const recruiters = allTwins.filter((x) => x.intent === "Recruiter").length;
    const clients = allTwins.filter((x) => x.intent === "Potential Client").length;
    const suspicious = allTwins.filter((x) => x.intent === "Suspicious User").length;

    res.json({
      totalAnalysed: allTwins.length,
      showing: visibleTwins.length,
      hotLeads,
      recruiters,
      clients,
      suspicious,
      percentages: {
        hotLeads: Math.round((hotLeads / total) * 100),
        recruiters: Math.round((recruiters / total) * 100),
        clients: Math.round((clients / total) * 100),
        suspicious: Math.round((suspicious / total) * 100)
      },
      twins: visibleTwins
    });
  } catch (err) {
    res.status(500).json({ error: "Digital Twin analysis failed" });
  }
});

app.get("/api/admin/soc", auth, async (req, res) => {
  const now = Date.now();

  const liveIps = [...socFirewall.entries()].map(([ip, data]) => ({
    ip,
    requestsLast30s: data.hits.filter((t) => now - t < 30000).length,
    blocked: data.blockedUntil && now < data.blockedUntil,
    blockedUntil: data.blockedUntil ? new Date(data.blockedUntil) : null,
    score: data.score || 0
  })).sort((a, b) => b.requestsLast30s - a.requestsLast30s);

  const critical = socEvents.filter((e) => e.severity === "CRITICAL").length;
  const high = socEvents.filter((e) => e.severity === "HIGH").length;
  const medium = socEvents.filter((e) => e.severity === "MEDIUM").length;

  const threatScore = Math.min(100, critical * 25 + high * 12 + medium * 5);

  res.json({
    securityScore: Math.max(0, 100 - threatScore),
    emergencyLockdown,
    threatScore,
    threatLevel: threatScore >= 80 ? "CRITICAL" : threatScore >= 55 ? "HIGH" : threatScore >= 25 ? "MEDIUM" : "LOW",
    activeIps: liveIps.length,
    topIps: liveIps.slice(0, 10),
    blockedIps: [
      ...(await BlockedIP.find().sort({ createdAt: -1 }).limit(100).lean()).map((x) => ({
        ip: x.ip,
        blocked: true,
        manual: true,
        reason: x.reason,
        expiresAt: x.expiresAt
      })),
      ...liveIps.filter((x) => x.blocked)
    ],
    events: socEvents.slice(0, 80),
    recommendation:
      threatScore >= 80
        ? "Critical traffic spike detected. Enable Cloudflare protection and keep SOC firewall active."
        : threatScore >= 55
        ? "High suspicious traffic detected. Monitor top IPs and failed login events."
        : "Portfolio traffic looks stable. NS.ai SOC is actively monitoring."
  });
});


app.post("/api/admin/soc/block", auth, async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });

  manualBlockedIps.add(ip);
  addSocEvent({
    type: "MANUAL_BLOCK",
    severity: "HIGH",
    ip,
    path: "/api/admin/soc/block",
    reason: "Admin manually blocked this IP"
  });

  res.json({ success: true });
});

app.post("/api/admin/soc/lockdown", auth, async (req, res) => {
  emergencyLockdown = !!req.body.enabled;

  addSocEvent({
    type: emergencyLockdown ? "EMERGENCY_LOCKDOWN_ON" : "EMERGENCY_LOCKDOWN_OFF",
    severity: emergencyLockdown ? "CRITICAL" : "LOW",
    ip: req.ip,
    path: "/api/admin/soc/lockdown",
    reason: emergencyLockdown
      ? "Emergency lockdown enabled by admin"
      : "Emergency lockdown disabled by admin"
  });

  res.json({ success: true, emergencyLockdown });
});

app.post("/api/admin/soc/unblock", auth, async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });

  // Remove from in-memory firewall map
  socFirewall.delete(ip);
  // Remove from manual block set
  manualBlockedIps.delete(ip);

  // FIX: Also remove from MongoDB so the block does not survive a server restart
  try {
    await BlockedIP.deleteOne({ ip });
  } catch (e) {
    console.error("SOC unblock DB remove failed:", e.message);
  }

  addSocEvent({
    type: "MANUAL_UNBLOCK",
    severity: "LOW",
    ip,
    path: "/api/admin/soc/unblock",
    reason: "Admin manually unblocked IP"
  });
  res.json({ success: true });
});


app.post("/api/admin/ip/block", auth, async (req, res) => {
  try {
    const { duration = "permanent", reason = "Blocked by NS.ai SOC" } = req.body;
    const ip = cleanIp(req.body.ip);
    if (!ip) return res.status(400).json({ error: "IP required" });

    let expiresAt = null;
    const now = Date.now();

    if (duration === "1h") expiresAt = new Date(now + 60 * 60 * 1000);
    if (duration === "6h") expiresAt = new Date(now + 6 * 60 * 60 * 1000);
    if (duration === "24h") expiresAt = new Date(now + 24 * 60 * 60 * 1000);
    if (duration === "7d") expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);

    const item = await BlockedIP.findOneAndUpdate(
      { ip },
      { ip, reason, expiresAt, blockedBy: "Admin", createdAt: new Date() },
      { upsert: true, new: true }
    );

    addSocEvent?.({
      type: "IP_BLOCKED",
      severity: duration === "permanent" ? "HIGH" : "MEDIUM",
      ip,
      path: "/api/admin/ip/block",
      reason: `${ip} blocked for ${duration}`
    });

    await sendNsaiSecurityAlert({
      title: "Admin Manual IP Block Activated",
      severity: duration === "permanent" ? "HIGH" : "MEDIUM",
      ip,
      reason: `Admin manually blocked this IP from NS.ai SOC Panel for ${duration}.`,
      path: "/api/admin/ip/block",
      blockedUntil: expiresAt,
      info: await getSecurityContext(req, ip, "ADMIN_MANUAL_BLOCK")
    });

    res.json({ success: true, blocked: item });
  } catch (err) {
    res.status(500).json({ error: "Block IP failed" });
  }
});

app.post("/api/admin/ip/unblock", auth, async (req, res) => {
  try {
    const ip = cleanIp(req.body.ip);
    if (!ip) return res.status(400).json({ error: "IP required" });

    await BlockedIP.deleteOne({ ip });

    addSocEvent?.({
      type: "IP_UNBLOCKED",
      severity: "LOW",
      ip,
      path: "/api/admin/ip/unblock",
      reason: `${ip} manually unblocked`
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Unblock IP failed" });
  }
});


app.delete("/api/admin/ip/clear-all", auth, async (req, res) => {
  await BlockedIP.deleteMany({});
  res.json({ success: true, message: "All blocked IPs cleared" });
});

app.get("/api/admin/ip/blocked", auth, async (req, res) => {
  const items = await BlockedIP.find().sort({ createdAt: -1 }).lean();
  res.json(items);
});

app.get("/api/admin/security-logs", auth, async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(logs);
  } catch {
    res.status(500).json({ error: "Security logs failed" });
  }
});




/* =========================
   NS CONTROL HUB API
========================= */

const sseClients = [];
function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write(msg); } catch { sseClients.splice(i, 1); }
  }
}

app.get("/api/ns-control/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  });
  res.write(":\n\n");
  const keepAlive = setInterval(() => res.write(":\n\n"), 30000);
  sseClients.push(res);
  req.on("close", () => {
    clearInterval(keepAlive);
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

async function getPortfolioContentDoc() {
  let content = await PortfolioContent.findOne();
  if (!content) content = await PortfolioContent.create({});
  return content;
}


const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  }
});

function uploadImageToCloudinary(fileBuffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "portfolio-projects",
        public_id: originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_"),
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

app.post("/api/ns-control/upload-image", auth, imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image uploaded" });
    const result = await uploadImageToCloudinary(req.file.buffer, req.file.originalname);
    res.json({ success: true, imageUrl: result.secure_url, publicId: result.public_id });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});


const resumeFileSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  data: Buffer,
  size: Number,
  createdAt: { type: Date, default: Date.now }
});
const ResumeFile = mongoose.model("ResumeFile", resumeFileSchema);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF resume files are allowed"));
    cb(null, true);
  }
});

function uploadResumeToCloudinary(fileBuffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "portfolio-resume",
        public_id: originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf",
        overwrite: true
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

app.post("/api/ns-control/upload-resume", auth, resumeUpload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No resume uploaded" });

    await ResumeFile.deleteMany({});

    await ResumeFile.create({
      filename: "Naitik-Soni-Resume.pdf",
      contentType: "application/pdf",
      data: req.file.buffer,
      size: req.file.size
    });

    const content = await getPortfolioContentDoc();
    content.resumeUrl = "/api/ns-control/resume-download";
    content.updatedAt = new Date();
    await content.save();

    res.json({
      success: true,
      message: "Resume uploaded successfully",
      resumeUrl: "/api/ns-control/resume-download"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/ns-control/resume-download", async (req, res) => {
  try {
    const file = await ResumeFile.findOne().sort({ createdAt: -1 });
    if (!file) return res.status(404).send("Resume not found");

    // FIX: Frontend sends real visitor IP in X-Public-IP header (from api.ipify.org).
    // Prefer that over x-forwarded-for which is Render's internal proxy IP.
    const xPublicIp = req.headers["x-public-ip"] ? cleanIp(req.headers["x-public-ip"]) : null;
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const ip = xPublicIp || cleanIp(forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    // Allow the frontend to fetch this as a blob (needed for proper tracking)
    res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
    res.setHeader("Access-Control-Allow-Headers", "X-Public-IP");


    const uaString = req.headers["user-agent"] || "";
    const parser = new UAParser(uaString);
    const uaResult = parser.getResult();

    await ResumeDownload.create({
      ip,
      publicIp: ip,
      page: "/resume-download",
      city: geo.city || "Unknown",
      region: geo.region || "Unknown",
      country: geo.country || "Unknown",
      countryCode: geo.countryCode || "",
      isp: geo.isp || "Unknown",
      lat: geo.lat || null,
      lng: geo.lng || null,
      browser: `${uaResult.browser?.name || "Unknown"}${uaResult.browser?.version ? " " + uaResult.browser.version.split(".")[0] : ""}`,
      os: `${uaResult.os?.name || "Unknown"}${uaResult.os?.version ? " " + uaResult.os.version : ""}`,
      device: uaResult.device?.type ? uaResult.device.type.charAt(0).toUpperCase() + uaResult.device.type.slice(1) : "Desktop",
      userAgent: uaString,
      createdAt: new Date()
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Naitik-Soni-Resume.pdf");
    res.setHeader("Content-Length", file.data.length);

    return res.send(file.data);
  } catch (error) {
    console.log("Resume download failed:", error.message);
    return res.status(500).send("Resume download failed");
  }
});

app.get("/api/ns-control/content", async (req, res) => {
  try {
    const content = await getPortfolioContentDoc();
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/ns-control/content", auth, async (req, res) => {
  try {
    const content = await getPortfolioContentDoc();
    const sanitized = { ...req.body };
    if (sanitized.aboutText && typeof sanitized.aboutText === "string") {
      sanitized.aboutText = sanitizeHtmlInput(sanitized.aboutText);
    }
    if (sanitized.copyrightYear !== undefined) {
      const year = String(sanitized.copyrightYear).trim();
      if (year && !/^\d{4}$/.test(year)) {
        return res.status(400).json({ success: false, message: "Copyright year must be a 4-digit year (e.g. 2026)" });
      }
      const num = parseInt(year, 10);
      if (year && (num < 2000 || num > 2099)) {
        return res.status(400).json({ success: false, message: "Copyright year must be between 2000 and 2099" });
      }
      sanitized.copyrightYear = year;
    }
    Object.assign(content, sanitized, { updatedAt: new Date() });
    await content.save();
    broadcastSSE("content-updated", {});
    res.json({ success: true, message: "NS Control Hub content updated", data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/ns-control/projects", async (req, res) => {
  try {
    const data = await PortfolioProject.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/ns-control/projects", auth, async (req, res) => {
  try {
    const sanitized = { ...req.body };
    if (sanitized.description && typeof sanitized.description === "string") {
      sanitized.description = sanitizeHtmlInput(sanitized.description);
    }
    const item = await PortfolioProject.create({
      ...sanitized,
      techStack: Array.isArray(sanitized.techStack)
        ? sanitized.techStack
        : String(sanitized.techStack || "").split(",").map(x => x.trim()).filter(Boolean)
    });
    broadcastSSE("projects-updated", {});
    res.status(201).json({ success: true, message: "Project saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/api/ns-control/projects/:id", auth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.description && typeof update.description === "string") {
      update.description = sanitizeHtmlInput(update.description);
    }
    if (update.techStack && !Array.isArray(update.techStack)) {
      update.techStack = String(update.techStack).split(",").map(x => x.trim()).filter(Boolean);
    }
    const item = await PortfolioProject.findByIdAndUpdate(req.params.id, update, { new: true });
    broadcastSSE("projects-updated", {});
    res.json({ success: true, message: "Project updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/ns-control/projects/:id", auth, async (req, res) => {
  try {
    await PortfolioProject.findByIdAndDelete(req.params.id);
    broadcastSSE("projects-updated", {});
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/ns-control/certifications", async (req, res) => {
  try {
    const data = await PortfolioCertification.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/ns-control/certifications", auth, async (req, res) => {
  try {
    const sanitized = { ...req.body };
    if (sanitized.analysisText && typeof sanitized.analysisText === "string") {
      sanitized.analysisText = sanitizeHtmlInput(sanitized.analysisText);
    }
    const item = await PortfolioCertification.create(sanitized);
    broadcastSSE("certifications-updated", {});
    res.status(201).json({ success: true, message: "Certification saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/api/ns-control/certifications/:id", auth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.analysisText && typeof update.analysisText === "string") {
      update.analysisText = sanitizeHtmlInput(update.analysisText);
    }
    const item = await PortfolioCertification.findByIdAndUpdate(req.params.id, update, { new: true });
    broadcastSSE("certifications-updated", {});
    res.json({ success: true, message: "Certification updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/ns-control/certifications/:id", auth, async (req, res) => {
  try {
    await PortfolioCertification.findByIdAndDelete(req.params.id);
    broadcastSSE("certifications-updated", {});
    res.json({ success: true, message: "Certification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/ns-control/skills", async (req, res) => {
  try {
    const data = await PortfolioSkill.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/ns-control/skills", auth, async (req, res) => {
  try {
    const sanitized = { ...req.body };
    if (sanitized.name && typeof sanitized.name === "string") {
      sanitized.name = sanitizeHtmlInput(sanitized.name);
    }
    const item = await PortfolioSkill.create(sanitized);
    res.status(201).json({ success: true, message: "Skill saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/api/ns-control/skills/:id", auth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.name && typeof update.name === "string") {
      update.name = sanitizeHtmlInput(update.name);
    }
    const item = await PortfolioSkill.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, message: "Skill updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/ns-control/skills/:id", auth, async (req, res) => {
  try {
    await PortfolioSkill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Skill deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
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
You are NS.ai Pro, the private executive AI analyst and security operations assistant for Naitik Soni.

OWNER PROFILE:
- Name: Naitik Soni
- Alias: NScyber1417
- Role: Cybersecurity Engineer, Ethical Hacker, Full Stack Web Developer
- Founder: NS Indian Cyber Army's
- Portfolio focus: cybersecurity, ethical hacking, secure systems, full-stack projects, analytics, SOC-style monitoring
- Communication style required: professional English only. Do not reply in Gujarati, Hindi, or Hinglish.

COMMUNICATION RULES:
- The welcome screen, greeting, onboarding text, and first interaction must always be in professional English.
- After the user sends a message, automatically detect the user's language.
- If the user writes in English, reply in professional English.
- If the user writes in Gujarati, reply in Gujarati.
- If the user writes in Hindi, reply in Hindi.
- If the user writes in Hinglish, reply in Hinglish.
- Keep the same language throughout the conversation unless the user changes language.
- Never translate unless requested.

STRICT RESPONSE RULES:
- Be practical, confident, and structured.
- Use the provided dashboard/security data as truth.
- Do not invent numbers that are not present.
- If data is missing, say "No data available for this metric yet."
- Do not claim you directly changed code or deployed fixes.
- If asked to fix a bug, provide safe diagnostic steps and exact patch suggestions for Naitik to approve.
- For cybersecurity topics, stay defensive, legal, and admin-focused.

CAPABILITIES:
1. Executive Analytics Analyst
   - Summarize traffic, visitors, countries, cities, devices, pages, messages, resume activity, and growth.
2. Security Operations Analyst
   - Analyze failed logins, suspicious IPs, blocked IPs, brute-force signs, and security logs.
3. Portfolio Growth Advisor
   - Recommend CTA, SEO, UX, project-page, and contact-flow improvements.
4. Bug Diagnostic Assistant
   - Explain likely frontend/backend issues, API problems, deployment problems, environment variable problems, MongoDB/API errors, and safe terminal checks.
5. Daily Report Assistant
   - Generate concise CEO-style daily reports suitable for email.
6. Action Planner
   - End important answers with "Recommended Next Actions" when useful.

OUTPUT FORMAT:
Use this format when the user asks for analysis/report:
- Executive Summary
- Key Metrics
- Security Status
- Observations
- Recommended Next Actions

Use this format when the user asks for bug fixing:
- Issue Summary
- Likely Cause
- Verification Commands
- Safe Fix
- What to Check After Fix

ADMIN DASHBOARD DATA:
${JSON.stringify(dashboard || {}, null, 2)}

SECURITY DATA:
${JSON.stringify(security || {}, null, 2)}

USER QUESTION:
${question}
`;

    let answer = "";

    if (process.env.OPENROUTER_API_KEY) {
      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://naitiksoni1417.netlify.app",
            "X-Title": "NS.ai Admin Agent"
          },
          body: JSON.stringify({
            model: process.env.NSAI_MODEL || "openai/gpt-4o",
            messages: [
              { role: "system", content: "You are NS.ai Pro, Naitik Soni's private executive admin analyst. Start in professional English, then match the user's language after their message." },
              { role: "user", content: prompt }
            ],
            temperature: 0.25,
            max_tokens: 550
          })
        });

        const aiData = await aiRes.json();

        if (!aiRes.ok) {
          console.error("OpenRouter API error:", aiRes.status, JSON.stringify(aiData).slice(0, 500));
        } else {
          answer = aiData?.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("OpenRouter fetch failed:", e.message);
      }
    }

    if (!answer && process.env.GEMINI_API_KEY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.0-flash"}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        const aiData = await aiRes.json();
        if (!aiRes.ok) {
          console.error("Gemini API error:", aiRes.status, JSON.stringify(aiData).slice(0, 500));
        } else {
          answer = aiData?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
        }
      } catch (e) {
        console.error("Gemini fetch failed:", e.message);
      }
    }

    if (!answer) {
      const d = dashboard || {};
      const s = security || {};
      const q = (question || "").toLowerCase();
      let fb = "";

      if (q.includes("visitor") || q.includes("traffic") || q.includes("overview") || q.includes("summary")) {
        fb = `**NS.ai Pro — Executive Summary**\n\n**Today's Performance:**\n- Views today: ${d.todayViews || 0}\n- Total visitors: ${d.totalVisitors || 0}\n- Active sessions: ${d.activeSessions || 0}\n- Messages: ${d.totalMessages || 0} (${d.unreadMessages || 0} unread)\n\n**Top Countries:** ${(d.countries || []).slice(0, 5).map((c) => c._id || c.country).join(", ") || "No data yet"}\n\n**Top Pages:** ${(d.topPages || []).slice(0, 5).map((p) => p._id || p.page).join(", ") || "No data yet"}\n\n**Devices:** ${(d.devices || []).slice(0, 3).map((d) => d._id || d.device).join(", ") || "No data yet"}\n\n**Recommended Actions:**\n1. Review top-performing pages and optimize CTAs\n2. Check security logs for suspicious activity\n3. Follow up on unread messages`;
      } else if (q.includes("security") || q.includes("login") || q.includes("blocked") || q.includes("audit")) {
        fb = `**NS.ai Pro — Security Audit**\n\n**Security Status:**\n- Failed login attempts: ${s.failedLoginCount || 0}\n- Blocked IPs: ${(s.blockedIps || []).length}\n- Suspicious IPs: ${(s.suspiciousIps || []).length}\n\n**Recent Security Logs:**\n${(s.logs || []).slice(0, 5).map((l) => `- ${l.action}: ${l.ip || "Unknown"} — ${l.reason || "No reason"} (${l.createdAt ? new Date(l.createdAt).toLocaleString() : ""})`).join("\n") || "No recent security events"}\n\n**Recommended Actions:**\n1. Review blocked IPs and unblock if necessary\n2. Monitor suspicious IP patterns\n3. Check for brute-force attempts`;
      } else if (q.includes("message") || q.includes("contact")) {
        fb = `**NS.ai Pro — Messages Summary**\n\n- Total messages: ${d.totalMessages || 0}\n- Unread: ${d.unreadMessages || 0}\n\n${(d.messages || []).slice(0, 3).map((m) => `**${m.name || "Unknown"}** (${m.email || "No email"}):\n"${(m.message || "").slice(0, 120)}"\nStatus: ${m.status || "Unknown"} — ${m.city || ""}, ${m.country || ""}`).join("\n\n") || "No messages yet"}\n\n**Recommended Actions:**\n1. Reply to unread messages promptly\n2. Follow up on important inquiries`;
      } else if (q.includes("chart") || q.includes("graph") || q.includes("traffic")) {
        fb = `**NS.ai Pro — Traffic Analysis**\n\n**Daily Views (last 7 days):**\n${(d.dailyViews || []).slice(-7).map((v) => `- ${v.date || v._id}: ${v.views || 0} views`).join("\n") || "No chart data available"}\n\n**Traffic Sources:**\n- Top browser: ${(d.browsers || [])[0]?._id || "Unknown"}\n- Top OS: ${(d.osStats || [])[0]?._id || "Unknown"}\n- Top device: ${(d.devices || [])[0]?._id || "Unknown"}`;
      } else {
        fb = `**NS.ai Pro — Dashboard Overview**\n\n**Key Metrics:**\n- Today Views: ${d.todayViews || 0}\n- Total Visitors: ${d.totalVisitors || 0}\n- Active Sessions: ${d.activeSessions || 0}\n- Messages: ${d.totalMessages || 0}\n- Failed Logins: ${s.failedLoginCount || 0}\n- Blocked IPs: ${(s.blockedIps || []).length}\n\n**Top Countries:** ${(d.countries || []).slice(0, 3).map((c) => c._id || c.country).join(", ") || "No data yet"}\n\n*NS.ai Pro is running in summary mode. For full AI-powered analysis, configure OPENROUTER_API_KEY or GEMINI_API_KEY on Render.*`;
      }

      answer = fb;
    }

    res.json({ answer });
  } catch (err) {
    console.error("NS.ai error:", err.message);
    res.status(500).json({ error: "NS.ai request failed" });
  }
});



async function sendDailyAdminReport() {
  if (process.env.DAILY_REPORT_ENABLED !== "true") return;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.REPORT_EMAIL) return;
  if (!process.env.RESEND_API_KEY) {
    console.warn("[NS.ai] sendDailyAdminReport: RESEND_API_KEY is not set — skipping email dispatch.");
    return;
  }

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

  const clean = escapeHtml;

  const listRows = (items, icon) => items.map((x, i) => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,.18)">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div style="font-weight:900;color:#e5f3ff">${icon} ${i + 1}. ${clean(x._id)}</div>
        <div style="font-weight:1000;color:#67e8f9">${x.count}</div>
      </div>
      <div style="height:8px;background:#1e293b;border-radius:999px;overflow:hidden;margin-top:9px">
        <div style="height:8px;width:${Math.min(100, Math.max(8, Math.round((x.count / Math.max(1, totalVisitors)) * 100)))}%;background:linear-gradient(90deg,#06b6d4,#8b5cf6,#22c55e);border-radius:999px"></div>
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
        <h1 style="margin:12px 0 10px;font-size:42px;line-height:1.05">NS.ai | Executive Portfolio Intelligence Report</h1>
        <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.6">Advanced analytics, lead intelligence, and security overview for Naitik Soni.</p>

        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:26px">
          <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:22px">
            <div style="font-size:13px;color:#a7f3d0;font-weight:1000">EXECUTIVE SUMMARY</div>
            <p style="margin:10px 0 0;color:#e2e8f0;line-height:1.8;font-weight:700">
              NS.ai detected <b>${trafficLevel}</b> portfolio activity today. Visitor growth is <b>${visitorGrowth}%</b>,
              top audience location is <b>${escapeHtml(topCity)}</b>, top browser is <b>${escapeHtml(topBrowser)}</b>, and security threat level is <b>${escapeHtml(threatLevel)}</b>.
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
            <li>Optimize top page <b>${escapeHtml(topPage)}</b> for better conversions.</li>
            <li>Keep tracking visitors from <b>${escapeHtml(topCity)}</b> audience segment.</li>
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
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Threat</b><br/><span style="font-size:30px;font-weight:1000;color:#fbbf24">${escapeHtml(threatLevel)}</span></div>
          <div style="background:#020617;border-radius:18px;padding:16px"><b>Backend</b><br/><span style="font-size:24px;font-weight:1000;color:#86efac">ONLINE</span></div>
        </div>
      </div>

      <div style="text-align:center;color:#94a3b8;font-size:13px;font-weight:900;margin:28px 0">
        Generated by <b style="color:#67e8f9">NS.ai</b> • Portfolio Intelligence Platform<br/>
        Developed by Naitik Soni • Cybersecurity Engineer • Ethical Hacker
      </div>
    </div>
  </div>`; const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NS.ai Reports <onboarding@resend.dev>",
        to: process.env.REPORT_EMAIL,
        subject: `NS.ai | Executive Portfolio Intelligence Report - ${new Date().toLocaleDateString("en-IN")}`,
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
      error: "Daily report failed"
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

const nsAiRateLimit = new Map();
const contactRateLimit = new Map();
const trackRateLimit = new Map();

function rateLimitCheck(map, ip, windowMs, maxRequests) {
  const now = Date.now();
  const record = map.get(ip) || { hits: [] };
  record.hits = record.hits.filter(t => now - t < windowMs);
  record.hits.push(now);
  map.set(ip, record);
  return record.hits.length <= maxRequests;
}

setInterval(() => {
  const now = Date.now();
  [nsAiRateLimit, contactRateLimit, trackRateLimit].forEach(map => {
    for (const [ip, record] of map) {
      record.hits = record.hits.filter(t => now - t < 120000);
      if (record.hits.length === 0) map.delete(ip);
    }
  });
}, 10 * 60 * 1000);

app.post("/api/ns-ai", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, reply: "Message is required." });
    }

    if (typeof message !== "string" || message.length > 2000) {
      return res.status(400).json({ success: false, reply: "Message too long (max 2000 chars)." });
    }

    const ip = getClientIp(req);

    if (!rateLimitCheck(nsAiRateLimit, ip, 2 * 60 * 1000, 100)) {
      return res.status(429).json({ success: false, reply: "Too many requests. Please wait a moment." });
    }

    // FIX: genAI is null when GEMINI_API_KEY is not set — guard before calling getGenerativeModel
    if (!genAI) {
      console.warn("⚠️  NS.ai: GEMINI_API_KEY not set. /api/ns-ai is unavailable.");
      return res.status(503).json({
        success: false,
        reply: "NS.ai is not configured. Please set GEMINI_API_KEY in environment variables."
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `You are NS.ai, a professional and friendly AI portfolio assistant developed by Naitik Soni.
Your primary role is to answer questions only about:
- Naitik Soni (ethical hacker, full stack developer, cybersecurity student at SVIT Vasad / GTU, handle: Naitik.infosec / NScyber1417)
- Portfolio and its sections
- Projects:
  * NSphotoX (image OSINT / metadata forensics)
  * WebinfoX (cyber reconnaissance, WHOIS, DNS, SSL, and OSINT workflows)
  * NSMusic Air
- Certificates (ethical hacking, Kali Linux, advanced cybersecurity, Red Team vs Blue Team, dark web awareness, Cyber Leelawat internship achievements)
- Skills (cybersecurity, OSINT, recon, ethical hacking, Linux, Python, React, Node.js, secure web development, and reporting)
- Contact information (naitik.infosec@gmail.com or contact form)
- Cybersecurity journey
- NS Indian Cyber Army (which he founded)

Rules:
1. Keep answers short, professional, and friendly.
2. Answer only about Naitik Soni, his portfolio, and the topics listed above.
3. If the user asks about unrelated topics, politely say: "NS.ai can only answer about Naitik Soni and his portfolio."`
    });

    const result = await model.generateContent(message);
    const reply = result.response.text().trim();

    res.json({
      success: true,
      reply
    });
  } catch (error) {
    console.error("NS.ai Error:", error.message);
    res.status(500).json({
      success: false,
      reply: "NS.ai is temporarily unavailable. Please try again later."
    });
  }
});

function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("❌ FATAL: JWT_SECRET is missing from environment variables.");
    console.error("   Set JWT_SECRET in your .env file or environment.");
    process.exit(1);
  }

  if (secret.trim().length === 0) {
    console.error("❌ FATAL: JWT_SECRET is empty.");
    console.error("   Set a non-empty value in your .env file.");
    process.exit(1);
  }

  const placeholders = [
    "change-me", "change_me", "changeme",
    "password", "secret", "jwt-secret",
    "your-secret", "your_secret", "yoursecret",
    "123456", "admin", "test",
    "placeholder", "todo", "fixme",
  ];

  if (placeholders.includes(secret.toLowerCase().trim())) {
    console.error(`❌ FATAL: JWT_SECRET contains a placeholder value: "${secret}".`);
    console.error("   Replace it with a strong, random secret.");
    process.exit(1);
  }

  if (secret.trim().length < 16) {
    console.error(`❌ FATAL: JWT_SECRET is too short (${secret.trim().length} chars). Minimum is 16.`);
    console.error("   Use a longer, randomly generated secret.");
    process.exit(1);
  }

  console.log("✅ JWT_SECRET validated.");
}

validateJwtSecret();

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
