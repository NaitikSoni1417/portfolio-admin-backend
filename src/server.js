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

dotenv.config();

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

  process.env.GEMINI_API_KEY

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
  sessionId: String,
  sessionDuration: { type: Number, default: 0 },
  pagesViewed: [String],
  screen: String,
  language: String,
  timezone: String,
  referrer: String,
  userAgent: String,
  status: { type: String, default: "Unread" },
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
  cpiText: { type: String, default: "Cybersecurity Engineer • Founder • Full Stack Developer" },
  statRank: { type: String, default: "20%" },
  statSuccess: { type: String, default: "100%" },
  statCompanies: { type: String, default: "10+" },
  statCpi: { type: String, default: "6.9" },
  aboutText: { type: String, default: "I build secure, modern and high-performance digital products." },
  resumeUrl: { type: String, default: "/Resume-Naitik-Soni.pdf" },
  githubUrl: { type: String, default: "" },
  linkedinUrl: { type: String, default: "" },
  instagramUrl: { type: String, default: "" },
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

  return safeIps.includes(cleanIp(ip));
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
        <h1 style="margin:14px 0 8px;font-size:30px;line-height:1.1">${title}</h1>
        <p style="margin:0;color:#cbd5e1;font-size:15px;font-weight:700">Sent by - NS.ai Security Operation Centre</p>
      </div>

      <div style="margin-top:18px;background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.9);border-radius:26px;padding:24px;box-shadow:0 20px 70px rgba(15,23,42,.12)">
        <div style="display:inline-block;background:${severity === "CRITICAL" ? "#fee2e2" : "#fef3c7"};color:${severity === "CRITICAL" ? "#dc2626" : "#b45309"};padding:10px 14px;border-radius:999px;font-weight:900;font-size:12px;letter-spacing:1px">${severity}</div>
        <h2 style="margin:18px 0 8px;font-size:22px">Suspicious activity detected</h2>
        <p style="margin:0;color:#475569;font-weight:700;line-height:1.7">${reason}</p>

        <table style="width:100%;margin-top:20px;border-collapse:separate;border-spacing:0 10px">
          ${rows.map(([k,v]) => `
          <tr>
            <td style="width:160px;background:#f8fafc;padding:14px;border-radius:14px 0 0 14px;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase">${k}</td>
            <td style="background:#f8fafc;padding:14px;border-radius:0 14px 14px 0;font-weight:800;word-break:break-word">${v || "Unknown"}</td>
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
      console.log("NS.ai SOC mail skipped: MAIL_USER / MAIL_PASS missing");
      return;
    }

    await transporter.sendMail({
      from: `"NS.ai Security Operation Centre" <${process.env.MAIL_USER}>`,
      to: SOC_ADMIN_EMAIL,
      subject: `🚨 ${payload.severity} NS.ai SOC Alert - ${payload.ip} - ${new Date().toLocaleString("en-IN")}`,
      html: nsaiSecurityMailTemplate(payload)
    });
  } catch (e) {
    console.log("NS.ai SOC mail failed:", e.message);
  }
}

function suspendedResponse(res, ip, reason = "Suspicious activity detected") {
  const safeIp = String(ip || "Unknown").replace(/[<>"']/g, "");
  const safeReason = String(reason || "Suspicious activity detected").replace(/[<>"']/g, "");
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return res.status(403).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>403 • NS.ai SOC Access Denied</title>
  <style>
    *{box-sizing:border-box}
    :root{--red:#ff2d2d;--red2:#ff5757;--dark:#020409;--panel:rgba(8,12,22,.78);--line:rgba(255,45,45,.34);--text:#f8fafc;--muted:#aeb7c8;--cyan:#67e8f9}
    body{
      margin:0;min-height:100vh;overflow-x:hidden;color:var(--text);
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
      background:
        radial-gradient(circle at 50% 35%,rgba(255,0,0,.18),transparent 28%),
        radial-gradient(circle at 85% 10%,rgba(255,45,45,.12),transparent 28%),
        linear-gradient(135deg,#030712 0%,#060912 42%,#09030a 100%);
    }
    body:before{
      content:"";position:fixed;inset:0;pointer-events:none;opacity:.34;
      background-image:
        linear-gradient(rgba(255,45,45,.055) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,45,45,.055) 1px,transparent 1px);
      background-size:42px 42px;
      mask-image:radial-gradient(circle at center,black,transparent 78%);
    }
    body:after{
      content:"";position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.14;
      background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 4px);
      animation:scan 7s linear infinite;
    }
    @keyframes scan{0%{transform:translateY(-40px)}100%{transform:translateY(40px)}}
    @keyframes glitch{0%,100%{text-shadow:0 0 24px rgba(255,45,45,.9)}20%{text-shadow:8px 0 #ff0000,-8px 0 #00e5ff}22%{text-shadow:none}40%{transform:skewX(-2deg)}42%{transform:skewX(2deg)}}
    @keyframes pulse{0%,100%{opacity:.65;filter:drop-shadow(0 0 18px rgba(255,45,45,.55))}50%{opacity:1;filter:drop-shadow(0 0 36px rgba(255,45,45,.95))}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    .wrap{position:relative;min-height:100vh;padding:28px;display:grid;grid-template-columns:330px 1fr 360px;gap:22px;align-items:stretch}
    .border{
      position:fixed;inset:14px;pointer-events:none;border:1px solid rgba(255,45,45,.35);
      box-shadow:inset 0 0 70px rgba(255,0,0,.08),0 0 55px rgba(255,0,0,.10);
      clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px);
    }
    .top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;margin-bottom:-4px}
    .brand{font-weight:950;letter-spacing:.24em;color:var(--red);text-transform:uppercase}
    .status{font-size:12px;font-weight:900;color:#22c55e;text-transform:uppercase;letter-spacing:.12em}
    .dot{display:inline-block;width:13px;height:13px;background:#22c55e;border-radius:50%;margin-left:9px;box-shadow:0 0 24px #22c55e}
    .panel{
      position:relative;border:1px solid var(--line);background:linear-gradient(180deg,rgba(10,15,26,.82),rgba(2,6,14,.72));
      border-radius:22px;padding:24px;box-shadow:0 30px 100px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.05);
      backdrop-filter:blur(18px);overflow:hidden;
    }
    .panel:before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,transparent,rgba(255,45,45,.08),transparent);transform:translateX(-100%);animation:shine 4s linear infinite}
    @keyframes shine{100%{transform:translateX(100%)}}
    .left,.right{display:flex;flex-direction:column;gap:20px}
    .shield{height:240px;display:flex;align-items:center;justify-content:center}
    .shield svg{width:170px;height:170px;animation:pulse 2.1s infinite}
    .label{font-size:13px;font-weight:950;letter-spacing:.18em;color:var(--red);text-transform:uppercase}
    .critical{font-size:32px;font-weight:950;color:var(--red);letter-spacing:.08em;margin:12px 0}
    .bars{display:flex;gap:6px;margin:14px 0}.bars span{height:11px;width:42px;background:var(--red);box-shadow:0 0 18px rgba(255,45,45,.7)}.bars span:nth-child(n+6){background:#111827;box-shadow:none;border:1px solid rgba(255,255,255,.08)}
    .log{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:13px;color:#cbd5e1;font-family:"SFMono-Regular",Consolas,monospace;font-size:14px}
    .log li:before{content:"> ";color:var(--red)}
    .center{display:flex;align-items:center;justify-content:center;min-height:720px}
    .main{width:100%;max-width:800px;text-align:center;padding:38px}
    .soc-title{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:10px 24px;color:var(--red2);font-weight:950;letter-spacing:.18em;text-transform:uppercase;background:rgba(255,45,45,.05)}
    .denied{margin:28px 0 0;font-size:36px;font-weight:950;color:var(--red2);letter-spacing:.12em;text-transform:uppercase}
    .code{font-size:150px;line-height:.86;margin:18px 0 8px;font-weight:1000;color:var(--red);letter-spacing:.04em;animation:glitch 3.2s infinite;text-shadow:0 0 36px rgba(255,45,45,.88)}
    .forbidden{font-size:40px;font-weight:950;color:var(--red2);letter-spacing:.22em;text-transform:uppercase}
    .msg{max-width:620px;margin:22px auto;color:#d7dce7;font-size:18px;line-height:1.65;font-weight:700}
    .data{margin:26px auto 0;text-align:left;border:1px solid var(--line);border-radius:18px;overflow:hidden;max-width:650px;background:rgba(0,0,0,.34)}
    .row{display:grid;grid-template-columns:190px 1fr;border-bottom:1px solid rgba(255,45,45,.18)}
    .row:last-child{border-bottom:0}.k{padding:15px 18px;color:#b9c0cf;font-family:Consolas,monospace;text-transform:uppercase}.v{padding:15px 18px;color:var(--red2);font-weight:950;font-family:Consolas,monospace;word-break:break-word}
    .notice{margin:22px auto 0;max-width:650px;border:1px solid rgba(255,45,45,.24);border-radius:18px;padding:18px;color:#cbd5e1;background:rgba(255,255,255,.04);text-align:left;line-height:1.55}
    .map{height:190px;position:relative;border-radius:18px;background:radial-gradient(circle at 68% 56%,rgba(255,45,45,.5),transparent 7%),linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.015));overflow:hidden}
    .map:before{content:"WORLD THREAT MAP";position:absolute;top:16px;left:18px;color:var(--red);font-weight:950;font-size:12px;letter-spacing:.16em}
    .map:after{content:"";position:absolute;inset:54px 22px 20px;background:
      radial-gradient(circle at 17% 42%,rgba(255,255,255,.28) 0 2px,transparent 3px),
      radial-gradient(circle at 31% 35%,rgba(255,255,255,.24) 0 2px,transparent 3px),
      radial-gradient(circle at 54% 45%,rgba(255,255,255,.24) 0 2px,transparent 3px),
      radial-gradient(circle at 70% 50%,rgba(255,45,45,.95) 0 5px,transparent 7px),
      radial-gradient(circle at 82% 38%,rgba(255,255,255,.22) 0 2px,transparent 3px);
      border:1px dashed rgba(255,255,255,.12);border-radius:16px;opacity:.9}
    .sideRows{display:grid;gap:11px;margin-top:16px}.sideRow{display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,45,45,.15);padding-bottom:9px;color:#cbd5e1}.sideRow b{color:var(--red2)}
    .help a{color:var(--red2);font-weight:950;text-decoration:none}
    .footer{grid-column:1/-1;text-align:center;color:#9ca3af;font-weight:800}.footer b{color:var(--red2)}
    @media (max-width:1100px){.wrap{grid-template-columns:1fr}.center{min-height:auto}.code{font-size:105px}.right,.left{grid-row:auto}.main{padding:26px}.row{grid-template-columns:1fr}.wrap{padding:18px}}
  </style>
</head>
<body>
  <div class="border"></div>
  <main class="wrap">
    <div class="top">
      <div>
        <div class="brand">NS.ai SOC</div>
        <div style="color:#9ca3af;font-size:12px;font-weight:800;margin-top:6px">REAL-TIME THREAT PROTECTION</div>
      </div>
      <div class="status">Secure Network Active <span class="dot"></span></div>
    </div>

    <section class="left">
      <div class="panel shield">
        <svg viewBox="0 0 120 120" fill="none">
          <path d="M60 8l38 16v28c0 27-16 50-38 60-22-10-38-33-38-60V24L60 8z" stroke="#ff2d2d" stroke-width="4"/>
          <rect x="38" y="52" width="44" height="34" rx="7" fill="#ff2d2d"/>
          <path d="M45 52v-9c0-10 7-18 15-18s15 8 15 18v9" stroke="#ff7b7b" stroke-width="6"/>
          <circle cx="60" cy="69" r="5" fill="#1f0303"/>
          <path d="M60 73v8" stroke="#1f0303" stroke-width="5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="panel">
        <div class="label">Threat Level</div>
        <div class="critical">CRITICAL</div>
        <div class="bars"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div style="color:#aeb7c8;font-weight:800">High risk detected</div>
      </div>
      <div class="panel">
        <div class="label">Security Log</div>
        <ul class="log">
          <li>Connection initiated</li>
          <li>IP scanned</li>
          <li>Behavior analysis</li>
          <li>Suspicious pattern detected</li>
          <li style="color:#ff5757">Access blocked</li>
          <li>Connection terminated</li>
        </ul>
        <div style="margin-top:22px;color:#9ca3af;font-family:Consolas,monospace">TIME: ${timestamp}</div>
      </div>
    </section>

    <section class="center">
      <div class="panel main">
        <div class="soc-title">NS.ai Security Operation Centre</div>
        <div class="denied">⚠ Access Denied ⚠</div>
        <div class="code">403</div>
        <div class="forbidden">Forbidden</div>
        <p class="msg">Your IP address is temporarily suspended due to suspicious activity detected by NS.ai SOC.</p>

        <div class="data">
          <div class="row"><div class="k">IP Address</div><div class="v">${safeIp}</div></div>
          <div class="row"><div class="k">Reason</div><div class="v">${safeReason}</div></div>
          <div class="row"><div class="k">Detected By</div><div class="v">NS.ai Security Firewall</div></div>
          <div class="row"><div class="k">Status</div><div class="v">BLOCKED</div></div>
          <div class="row"><div class="k">Contact</div><div class="v">naitik.infosec@gmail.com</div></div>
        </div>

        <div class="notice">
          This action has been taken to protect the portfolio systems and other users from potential threats.
          If you believe this is a mistake, contact the administrator.
        </div>
      </div>
    </section>

    <section class="right">
      <div class="panel">
        <div class="label">Location Detected</div>
        <div class="map"></div>
        <div class="sideRows">
          <div class="sideRow"><span>Country</span><b>Unknown</b></div>
          <div class="sideRow"><span>Region</span><b>Unknown</b></div>
          <div class="sideRow"><span>City</span><b>Unknown</b></div>
          <div class="sideRow"><span>ISP</span><b>Unknown ISP</b></div>
        </div>
      </div>
      <div class="panel">
        <div class="label">Addresses Tried</div>
        <ul class="log">
          <li>/admin</li>
          <li>/api/login</li>
          <li>/wp-admin</li>
          <li>/config.php</li>
          <li>/.env</li>
        </ul>
      </div>
      <div class="panel help">
        <div class="label">Need Help?</div>
        <p style="color:#cbd5e1;line-height:1.6;font-weight:750">If you believe this is a mistake, contact the administrator.</p>
        <a href="mailto:naitik.infosec@gmail.com">naitik.infosec@gmail.com</a>
      </div>
    </section>

    <div class="footer">Stay secure. Stay protected.<br><b>NS.ai Security Operation Centre</b><br><span style="font-size:12px">Developed by Naitik Soni</span></div>
  </main>
</body>
</html>`);
}

async function socMiddleware(req, res, next) {
  const ip = getClientIp(req, req.body?.publicIp || "");
  const now = Date.now();
  const windowMs = 30 * 1000;
  const blockMs = SOC_BLOCK_MS;

  if (isAdminProtectedIp(ip)) {
    return next();
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
    const ip = getClientIp(req, req.body?.publicIp || "");
    const blocked = await BlockedIP.findOne({ ip });

    if (blocked) {
      if (blocked.expiresAt && new Date(blocked.expiresAt) < new Date()) {
        await BlockedIP.deleteOne({ ip });
        return next();
      }

      return suspendedResponse(res, ip, blocked.reason || "Blocked by NS.ai SOC");
    }
  } catch {}
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

app.post("/api/music/play", async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.body.trackId).lean();
    if (!track) return res.status(404).json({ error: "Track not found" });

    const userAgent = req.body.userAgent || req.headers["user-agent"] || "";
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(req.body.publicIp || forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    await MusicPlay.create({
      trackId: track._id,
      title: track.title,
      ip,
      city: geo.city,
      country: geo.country,
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
    const ip = cleanIp(req.query.ip || req.headers["x-forwarded-for"]?.split(",")[0] || req.ip);
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

app.post("/api/track", socMiddleware, async (req, res) => {
  try {
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const rawIp = req.body.publicIp || req.body.ip || forwardedIp || req.clientIp || req.ip;
    const ip = cleanIp(rawIp);

    let geo = await lookupIpGeo(ip);
    let geoProvider = geo.country !== "Unknown" ? "lookupIpGeo" : "none";

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
      pagesViewed: req.body.pagesViewed || [],
      screen: req.body.screen || "",
      language: req.body.language || "",
      timezone: req.body.timezone || "",
      referrer: req.body.referrer || "",
      city: req.body.city || geo.city || "Unknown",
      region: req.body.region || geo.region || "Unknown",
      country: req.body.country || geo.country || "Unknown",
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
  } catch { }

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
  } catch { }

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
  } catch { }

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



app.get("/api/admin/test-soc-mail", async (req, res) => {
  try {
    const ip = getClientIp(req, req.query.publicIp || "");
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
    const { key, publicIp } = req.body;
    const ip = getClientIp(req, publicIp);
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



app.post("/api/resume-download", async (req, res) => {
  try {
    const userAgent = req.body.userAgent || req.headers["user-agent"] || "";
    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(req.body.publicIp || forwardedIp || req.clientIp || req.ip);
    const geo = await getGeo(ip);

    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    const item = await ResumeDownload.create({
      ip,
      publicIp: req.body.publicIp || ip,
      page: req.body.page || "/",
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp: geo.isp,
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


app.post("/api/admin/messages/:id/reply", auth, async (req, res) => {
  try {
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
            ${reply.replace(/\n/g, "<br/>")}
          </div>
          <p style="margin-top:24px;color:#64748b;font-size:13px">
            Original message from ${msg.name || "visitor"} was received through Naitik Soni Portfolio.
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
    res.status(500).json({ error: "Reply email failed", details: err.message });
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


app.get("/api/admin/settings", auth, async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});
  res.json(setting);
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
  socFirewall.delete(ip);
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
    const { ip, duration = "permanent", reason = "Blocked by NS.ai SOC" } = req.body;
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

    res.json({ success: true, blocked: item });
  } catch (err) {
    res.status(500).json({ error: "Block IP failed" });
  }
});

app.post("/api/admin/ip/unblock", auth, async (req, res) => {
  try {
    const { ip } = req.body;
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/ns-control/resume-download", async (req, res) => {
  try {
    const file = await ResumeFile.findOne().sort({ createdAt: -1 });
    if (!file) return res.status(404).send("Resume not found");

    const forwardedIp = req.headers["x-forwarded-for"]?.split(",")[0];
    const ip = cleanIp(req.query.publicIp || forwardedIp || req.clientIp || req.ip);
    const geo = await lookupIpGeo(ip);

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
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/ns-control/content", auth, async (req, res) => {
  try {
    const content = await getPortfolioContentDoc();
    Object.assign(content, req.body, { updatedAt: new Date() });
    await content.save();
    res.json({ success: true, message: "NS Control Hub content updated", data: content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/ns-control/projects", async (req, res) => {
  try {
    const data = await PortfolioProject.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/ns-control/projects", auth, async (req, res) => {
  try {
    const item = await PortfolioProject.create({
      ...req.body,
      techStack: Array.isArray(req.body.techStack)
        ? req.body.techStack
        : String(req.body.techStack || "").split(",").map(x => x.trim()).filter(Boolean)
    });
    res.status(201).json({ success: true, message: "Project saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/ns-control/projects/:id", auth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.techStack && !Array.isArray(update.techStack)) {
      update.techStack = String(update.techStack).split(",").map(x => x.trim()).filter(Boolean);
    }
    const item = await PortfolioProject.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, message: "Project updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/ns-control/projects/:id", auth, async (req, res) => {
  try {
    await PortfolioProject.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/ns-control/certifications", async (req, res) => {
  try {
    const data = await PortfolioCertification.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/ns-control/certifications", auth, async (req, res) => {
  try {
    const item = await PortfolioCertification.create(req.body);
    res.status(201).json({ success: true, message: "Certification saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/ns-control/certifications/:id", auth, async (req, res) => {
  try {
    const item = await PortfolioCertification.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: "Certification updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/ns-control/certifications/:id", auth, async (req, res) => {
  try {
    await PortfolioCertification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Certification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/ns-control/skills", async (req, res) => {
  try {
    const data = await PortfolioSkill.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/ns-control/skills", auth, async (req, res) => {
  try {
    const item = await PortfolioSkill.create(req.body);
    res.status(201).json({ success: true, message: "Skill saved", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/ns-control/skills/:id", auth, async (req, res) => {
  try {
    const item = await PortfolioSkill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: "Skill updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/ns-control/skills/:id", auth, async (req, res) => {
  try {
    await PortfolioSkill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Skill deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
            { role: "system", content: "You are NS.ai Pro, Naitik Soni’s private executive admin analyst. Start in professional English, then match the user’s language after their message." },
            { role: "user", content: prompt }
          ],
          temperature: 0.25,
          max_tokens: 550
        })
      });

      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        console.error("OpenRouter error:", JSON.stringify(aiData, null, 2));
        const fallback = `NS.ai Pro provider limit reached. Live summary: today views ${dashboard?.todayViews || 0}, total visitors ${dashboard?.totalVisitors || 0}, active sessions ${dashboard?.activeSessions || 0}, total messages ${dashboard?.totalMessages || 0}, failed login events ${security?.failedLoginCount || 0}. Recommended next action: check API provider limits and review backend logs.`;
        return res.json({ answer: fallback, fallback: true });
      }

      answer = aiData?.choices?.[0]?.message?.content || "";
    }

    if (!answer && process.env.GEMINI_API_KEY) {
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

app.post("/api/ns-ai", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, reply: "Message is required." });
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
    console.error("NS.ai Error:", error);
    res.status(500).json({
      success: false,
      reply: "NS.ai is temporarily unavailable. Please try again later."
    });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
