import React, { useEffect, useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import {
  FiActivity, FiBarChart2, FiClock, FiDownload, FiEye, FiExternalLink, FiGrid,
  FiGlobe, FiInbox, FiLogOut, FiMail, FiMenu, FiRefreshCw,
  FiSearch, FiShield, FiSmartphone, FiTrash2, FiTrendingUp,
  FiUsers, FiX, FiCheckCircle, FiCircle
} from "react-icons/fi";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import EarthView from "../components/admin/EarthView";

const API_URL = import.meta.env.VITE_API_URL || "https://portfolio-admin-backend-vsud.onrender.com";
const COLORS = ["#020617", "#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [token, setToken] = useState(localStorage.getItem("admin_token"));
  const [active, setActive] = useState("Overview");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [command, setCommand] = useState(null);
  const [liveRefresh, setLiveRefresh] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("admin_theme") || "light");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [menuHidden, setMenuHidden] = useState(localStorage.getItem("admin_menu_hidden") !== "no");
  const [adminIp, setAdminIp] = useState(localStorage.getItem("admin_ip") || "");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsCleared, setAlertsCleared] = useState(false);
  const [adminSettings, setAdminSettings] = useState(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsToast, setSettingsToast] = useState(null);
  const [settingsProgress, setSettingsProgress] = useState(0);
  const [socData, setSocData] = useState(null);
  const [digitalTwinData, setDigitalTwinData] = useState(null);
  const [selectedTwin, setSelectedTwin] = useState(null);
  const [blockedScreen, setBlockedScreen] = useState(null);
  const [selectedBlockDuration, setSelectedBlockDuration] = useState("1h");
  const [selectedSocIp, setSelectedSocIp] = useState(null);
  const [currentAdminIp, setCurrentAdminIp] = useState("");
  const [adminIpWarning, setAdminIpWarning] = useState(false);
  const [nsaiIntro, setNsaiIntro] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [selectedResumeDownload, setSelectedResumeDownload] = useState(null);

  const saveAdminIp = async () => {
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      const myIp = (ipData.ip || "").trim();
      if (myIp) {
        setAdminIp(myIp);
        localStorage.setItem("admin_ip", myIp);
      }
    } catch {}
  };

  const login = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        key,
        publicIp: await getPublicIp(),
      }),
      });

      const result = await res.json();
      if (!res.ok) return setError(result.error || "Invalid key");

      localStorage.setItem("admin_token", result.token);
      await saveAdminIp();

      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        const myIp = ipData.ip || "";
        setAdminIp(myIp);
        localStorage.setItem("admin_ip", myIp);
      } catch {}
      setToken(result.token);
    } catch {
      setError("Backend not connected");
    }
  };

  const toggleMenuHidden = () => {
    const next = !menuHidden;
    setMenuHidden(next);
    localStorage.setItem("admin_menu_hidden", next ? "yes" : "no");
  };

  const toggleThemeMode = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("admin_theme", next);
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setData(null);
  };

  const loadAdvancedAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/advanced-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAdvancedAnalytics(await res.json());
      } else {
        console.error("Advanced analytics API failed:", res.status);
      }
      clearInterval(progressTimer);
  } catch (err) {
    clearInterval(progressTimer);
      console.error("Advanced analytics error:", err);
    }
  };

  const loadDashboard = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) return logout();

      const result = await res.json();
      setData(result);
      setLastSync(new Date());
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/api/admin/messages/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      loadDashboard();
    } catch {
      alert("Status update failed");
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm("Delete this message?")) return;

    try {
      await fetch(`${API_URL}/api/admin/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadDashboard();
    } catch {
      alert("Delete failed");
    }
  };

  const exportVisitorsCSV = () => {
    const rows = [
      ["IP", "City", "Region", "Country", "ISP", "Browser", "OS", "Device", "Page", "Visits", "Returning", "Last Seen"],
      ...(data?.recentVisitors || []).map((v) => [
        v.ip || "",
        v.city || "",
        v.region || "",
        v.country || "",
        v.isp || "",
        v.browser || "",
        v.os || "",
        v.device || "",
        v.page || "",
        v.visits || 1,
        v.isReturning ? "Yes" : "No",
        v.createdAt ? new Date(v.createdAt).toLocaleString() : "",
      ]),
    ];

    downloadCSV(rows, "portfolio-visitors.csv");
  };

  const exportMessagesCSV = () => {
    const rows = [
      ["Name", "Email", "Message", "Status", "Created At"],
      ...(data?.messages || []).map((m) => [
        m.name || "",
        m.email || "",
        m.message || "",
        m.status || "",
        m.createdAt ? new Date(m.createdAt).toLocaleString() : "",
      ]),
    ];

    downloadCSV(rows, "portfolio-messages.csv");
  };


  const sendPasswordChangeAlert = async () => {
    const alertMessage = `Portfolio Admin password was changed.

Security Details:
Time: ${new Date().toLocaleString()}
Browser: ${navigator.userAgent}
Platform: ${navigator.platform}
Page: ${window.location.href}

If this change was made by you, no action is required.

If you did NOT make this change, immediately review your admin security logs and change your password again.`;

    try {
      await emailjs.send(
        "service_wlsw9bq",
        "template_z72771t",
        {
          from_name: "Portfolio Security Center",
          from_email: "naitik.infosec@gmail.com",
          message: alertMessage,
          browser_info: navigator.userAgent,
          platform: navigator.platform,
          page_url: window.location.href,
          submitted_at: new Date().toLocaleString(),
        },
        "z1i-8sob92WwBOt78"
      );
    } catch (err) {
      console.error("Password alert email failed:", err);
    }
  };

  const changeAdminPasswordSecure = async () => {
    setSettingsProgress(8);
    setSettingsToast({
      type: "loading",
      title: "Updating password",
      text: "NS.ai is securing your admin account..."
    });

    const progressTimer = setInterval(() => {
      setSettingsProgress((p) => (p >= 92 ? p : p + 7));
    }, 90);
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all password fields");
      return;
    }

    if (newPassword.length < 4) {
      alert("New password must be at least 4 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match");
      return;
    }

    if (currentPassword === newPassword) {
      alert("New password must be different from current password");
      return;
    }

    const res = await fetch(`${API_URL}/api/admin/change-password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newKey: newPassword }),
    });

    if (!res.ok) {
      alert("Password change failed");
      return;
    }

    await sendPasswordChangeAlert();

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setSettingsProgress(100);
      setSettingsToast({
        type: "success",
        title: "Password updated successfully",
        text: "Security email sent. Your admin password is now updated."
      });
      setTimeout(() => {
        setSettingsToast(null);
        setSettingsProgress(0);
      }, 2400);
  };

  useEffect(() => {
    if (token && !adminIp) saveAdminIp();
    loadDashboard();
  }, [token]);

  useEffect(() => {
    if (!liveRefresh || !token) return;
    const timer = setInterval(loadDashboard, 15000);
    return () => clearInterval(timer);
  }, [liveRefresh, token]);

  const dailyViews = (data?.dailyViews || []).map((i) => ({ date: i._id, views: i.views }));
  const topPages = (data?.topPages || []).map((i) => ({ page: i._id || "/", views: i.count }));
  const devices = (data?.devices || []).map((i) => ({ name: i._id || "Unknown", value: i.count }));
  const browsers = data?.browsers || [];
  const osStats = data?.osStats || [];
  const countries = data?.countries || [];
  const cities = data?.cities || [];
  const messages = data?.messages || [];

  const alertItems = [
    ...(data?.unreadMessages > 0
      ? [{
          type: "message",
          icon: "📩",
          title: "Unread Messages",
          text: `${data.unreadMessages} unread message${data.unreadMessages > 1 ? "s" : ""} waiting in CRM.`,
        }]
      : []),
    ...((data?.recentVisitors || []).slice(0, 2).map((v) => ({
      type: "visitor",
      icon: "🌍",
      title: "Recent Visitor",
      text: `${v.city || "Unknown"}, ${v.country || "Unknown"} • ${v.browser || "Unknown"} • ${v.page || "/"}`,
    }))),
    ...((advancedAnalytics?.failedLoginCount || 0) > 0
      ? [{
          type: "security",
          icon: "🚨",
          title: "Security Activity",
          text: `${advancedAnalytics.failedLoginCount} failed admin login events detected.`,
        }]
      : []),
  ];

  const alertCount = alertsCleared ? 0 : alertItems.length;

  const visitors = useMemo(() => {
    return (data?.recentVisitors || []).filter((v) =>
      `${v.ip}
                  {/* ADMIN_ME_BADGE_FINAL */}
                  {isAdminVisitor(v) && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
                      Admin / Me
                    </span>
                  )} ${v.page} ${v.browser} ${v.os} ${v.device} ${v.city} ${v.country} ${v.isp}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [data, query]);

  const menu = [
    ["Overview", <FiGrid />],
    ["Visitors", <FiUsers />],
    ["Messages", <FiInbox />],
    ["Resume Downloads", <FiActivity />],
    ["Analytics", <FiTrendingUp />],
    ["Security Logs", <FiShield />],
    ["SOC Panel", <FiShield />],
    ["Digital Twin Lab", <FiActivity />],
    ["Devices", <FiSmartphone />],
    ["Earth View", <FiGlobe />],
    ["NS.ai", <FiActivity />],
    ["Settings", <FiShield />],
  ];

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f6f8ff] text-slate-950 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),radial-gradient(circle_at_bottom_right,#ccfbf1,transparent_35%)]" />
        <form onSubmit={login} className="relative w-full max-w-md rounded-[2rem] border border-white bg-white/85 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xl">
            <FiShield className="text-3xl" />
          </div>

          <h1 className="text-center text-3xl font-black">Admin Workspace</h1>
          <p className="mt-2 text-center text-slate-500">Manage portfolio analytics and messages</p>

          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            placeholder="Enter admin key"
            className="mt-8 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-slate-950"
          />

          {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}

          <button className="mt-6 w-full rounded-2xl bg-slate-950 py-4 font-black text-white shadow-xl transition hover:scale-[1.01]">
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  const stats = [
    ["Total Visitors", data?.totalVisitors || 0, <FiUsers />, "All-time traffic"],
    ["Today Views", data?.todayViews || 0, <FiEye />, "Views today"],
    ["Active Sessions", data?.activeSessions || 0, <FiActivity />, "Live estimate"],
    ["Messages", data?.totalMessages || 0, <FiMail />, `${data?.unreadMessages || 0} unread`],
  ];

  // COMMAND_UPDATE_SAFE_FINAL
  const loadAdminSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAdminSettings(await res.json());
    } catch (err) {
      console.error("Settings load failed:", err);
    }
  };

  useEffect(() => {
    if (token && active === "Settings") loadAdminSettings();
  }, [token, active]);

  const saveAdminSettings = async (payload) => {
    setSettingsStatus("");
    setSettingsProgress(8);
    setSettingsToast({ type: "loading", title: "Saving settings", text: "NS.ai is updating your admin settings..." });

    const progressTimer = setInterval(() => {
      setSettingsProgress((p) => (p >= 92 ? p : p + 7));
    }, 90);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Settings update failed");

      clearInterval(progressTimer);
      setSettingsProgress(100);
      setAdminSettings(result.setting);
      setSettingsToast({ type: "success", title: "Settings saved successfully", text: "Your admin settings are now live and synced." });
      setTimeout(() => {
        setSettingsToast(null);
        setSettingsProgress(0);
      }, 2200);
    } catch (err) {
      clearInterval(progressTimer);
      setSettingsProgress(100);
      setSettingsToast({ type: "error", title: "Save failed", text: err.message || "Settings update failed" });
      setTimeout(() => {
        setSettingsToast(null);
        setSettingsProgress(0);
      }, 3000);
    }
  };

  const resetAllAdminData = async () => {
    if (resetConfirm !== "RESET DATA") {
      setSettingsStatus("Type RESET DATA to confirm.");
      return;
    }

    const ok = window.confirm("Danger Zone: This will clear visitors, messages and security logs. Continue?");
    if (!ok) return;

    setSettingsStatus("Resetting admin data...");
    try {
      const res = await fetch(`${API_URL}/api/admin/reset-data`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: resetConfirm }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Reset failed");

      setResetConfirm("");
      setSettingsStatus("All analytics, messages and security logs cleared ✅");
      await loadDashboard?.();
      await loadAdvancedAnalytics?.();
      await loadAdminSettings?.();
    } catch (err) {
      setSettingsStatus(err.message || "Reset failed");
    }
  };


  useEffect(() => {
    const loadCurrentAdminIp = async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        setCurrentAdminIp(data.ip || "");
      } catch {}
    };

    loadCurrentAdminIp();
  }, []);

  useEffect(() => {
    const checkBlocked = async () => {
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();

        const res = await fetch(`${API_URL}/api/security/check?ip=${ipData.ip}`);
        const data = await res.json();

        if (res.status === 403 || data.blocked) {
          console.log("Blocked check ignored for admin recovery", data);
          // // setBlockedScreen(data);
        }
      } catch {}
    };

    checkBlocked();
  }, []);

  const blockVisitorIp = async (ip, duration = selectedBlockDuration) => {
    if (ip === currentAdminIp) {
      setAdminIpWarning(true);
      return;
    }
    await fetch(`${API_URL}/api/admin/ip/block`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ip,
        duration,
        reason: "Blocked by NS.ai Admin Intelligence"
      }),
    });
    await loadSocPanel?.();
  };

  const unblockVisitorIp = async (ip) => {
    await fetch(`${API_URL}/api/admin/ip/unblock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ip }),
    });
    await loadSocPanel?.();
  };

  const loadDigitalTwins = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/digital-twins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDigitalTwinData(await res.json());
    } catch (err) {
      console.error("Digital Twin load failed:", err);
    }
  };

  useEffect(() => {
    if (token && active === "Digital Twin Lab") {
      loadDigitalTwins();
      const t = setInterval(loadDigitalTwins, 5000);
      return () => clearInterval(t);
    }
  }, [token, active]);

  const loadResumeDownloads = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/resume-downloads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setResumeData(await res.json());
    } catch (err) {
      console.error("Resume downloads load failed:", err);
    }
  };

  useEffect(() => {
    if (token && active === "Resume Downloads") {
      loadResumeDownloads();
      const t = setInterval(loadResumeDownloads, 5000);
      return () => clearInterval(t);
    }
  }, [token, active]);

  const exportResumeDownloadsCSV = () => {
    const rows = [
      ["IP", "City", "Region", "Country", "ISP", "Browser", "OS", "Device", "Page", "Downloaded At"],
      ...(resumeData?.recent || []).map((r) => [
        r.ip || "",
        r.city || "",
        r.region || "",
        r.country || "",
        r.isp || "",
        r.browser || "",
        r.os || "",
        r.device || "",
        r.page || "",
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
      ]),
    ];
    downloadCSV(rows, "resume-downloads.csv");
  };

  const loadSocPanel = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/soc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSocData(await res.json());
    } catch (err) {
      console.error("SOC load failed:", err);
    }
  };

  useEffect(() => {
    if (token && active === "SOC Panel") {
      loadSocPanel();
      const t = setInterval(loadSocPanel, 5000);
      return () => clearInterval(t);
    }
  }, [token, active]);

  const blockSocIp = async (ip) => {
    await fetch(`${API_URL}/api/admin/soc/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ip }),
    });
    await loadSocPanel();
  };

  const toggleSocLockdown = async () => {
    await fetch(`${API_URL}/api/admin/soc/lockdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !socData?.emergencyLockdown }),
    });
    await loadSocPanel();
  };

  const unblockSocIp = async (ip) => {
    await fetch(`${API_URL}/api/admin/soc/unblock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ip }),
    });
    await loadSocPanel();
  };

  const updateCommand = async (payload) => {
    try {
      await fetch(`${API_URL}/api/admin/command-center`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (typeof loadCommandCenter === "function") {
        await loadCommandCenter();
      }

      if (typeof loadDashboard === "function") {
        await loadDashboard();
      }
    } catch (err) {
      console.error("Command update failed:", err);
      alert("Command update failed");
    }
  };


  const playNsaiIntroSound = (onDone) => {
    try {
      // Small premium cyber beep sound
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(520, 0.00, 0.18);
      playTone(740, 0.18, 0.20);
      playTone(980, 0.40, 0.22);
    } catch (err) {
      console.log("Intro tone blocked:", err);
    }

    try {
      // Real voice intro
      window.speechSynthesis.cancel();

      const msg = new SpeechSynthesisUtterance(
        "Welcome to NS AI. Professional Admin Intelligence Panel. Developed by Naitik Soni."
      );

      msg.rate = 0.9;
      msg.pitch = 0.85;
      msg.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const bestVoice =
        voices.find((v) => v.name.toLowerCase().includes("google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      if (bestVoice) msg.voice = bestVoice;

      msg.onend = () => {
        setTimeout(() => {
          onDone?.();
        }, 500);
      };

      msg.onerror = () => {
        setTimeout(() => {
          onDone?.();
        }, 500);
      };

      setTimeout(() => {
        window.speechSynthesis.speak(msg);
      }, 350);
    } catch (err) {
      console.log("Voice intro blocked:", err);
      setTimeout(() => onDone?.(), 4200);
    }
  };

  const openNsaiWithIntro = () => {
    setNsaiIntro(true);
    setActive("NS.ai");
    setMenuHidden(true);

    try {
      window.speechSynthesis?.cancel();
    } catch {}

    let closed = false;
    const closeIntro = () => {
      if (closed) return;
      closed = true;
      setNsaiIntro(false);
    };

    playNsaiIntroSound(closeIntro);

    // Fallback only if browser speech onend does not fire
    setTimeout(closeIntro, 7500);
  };

  return (
    <div id="admin-dashboard-root" data-theme={theme} className={`min-h-screen transition-colors duration-300 ${theme === "dark" ? "bg-[#020617] text-white" : "bg-[#f6f8ff] text-slate-950"}`}>
      {blockedScreen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#020617] p-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,.24),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.22),transparent_35%)]" />

          <div className="relative w-full max-w-xl rounded-[2.5rem] border border-red-400/30 bg-white/10 p-8 text-center shadow-[0_0_120px_rgba(239,68,68,.25)] backdrop-blur-2xl">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20 text-5xl shadow-2xl">
              🚫
            </div>

            <p className="mt-6 text-xs font-black tracking-[0.4em] text-red-300">
              403 ACCESS DENIED
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Blocked by NS.ai Security Operations Center
            </h1>

            <p className="mt-4 text-sm font-bold leading-relaxed text-slate-300">
              Your IP has been restricted by the administrator due to suspicious activity or security policy.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5 text-left text-sm font-bold text-slate-300">
              <p><span className="text-slate-500">IP:</span> {blockedScreen.ip || "Unknown"}</p>
              <p className="mt-2"><span className="text-slate-500">Reason:</span> {blockedScreen.reason || "Blocked by NS.ai SOC"}</p>
              <p className="mt-2"><span className="text-slate-500">Expires:</span> {blockedScreen.expiresAt ? new Date(blockedScreen.expiresAt).toLocaleString() : "Permanent"}</p>
            </div>

            <p className="mt-6 text-sm font-black text-cyan-300">
              Contact: naitik.infosec@gmail.com
            </p>
          </div>
        </div>
      )}

      {nsaiIntro && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-[#020617] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,.28),transparent_36%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:42px_42px]" />

          <div className="relative mx-auto w-[92%] max-w-2xl rounded-[2.5rem] border border-cyan-300/20 bg-white/10 p-8 text-center shadow-[0_0_120px_rgba(34,211,238,.22)] backdrop-blur-2xl">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 text-5xl shadow-[0_0_70px_rgba(34,211,238,.55)] animate-pulse">
              ✦
            </div>

            <p className="mt-7 text-xs font-black tracking-[0.45em] text-cyan-300">
              REAL AI ADMIN AGENT
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
              Welcome to <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">NS.ai</span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-relaxed text-slate-300 md:text-lg">
              Professional Admin Intelligence Panel powered by real-time visitors, messages, security logs and AI insights.
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-sm font-black text-slate-200">
              Developed by <span className="text-cyan-300">Naitik Soni</span> • Portfolio Intelligence Platform
            </div>

            <div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full origin-left animate-[nsaiLoad_7s_ease-in-out_forwards] rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400" />
            </div>

            <p className="mt-4 text-xs font-black tracking-[0.25em] text-slate-400">
              INITIALIZING INTELLIGENCE CORE...
            </p>
          </div>

          <style>{`
            @keyframes nsaiLoad {
              0% { transform: scaleX(0); }
              100% { transform: scaleX(1); }
            }
          `}</style>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {settingsToast && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/40 bg-white/90 p-8 text-center shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400" />

            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-2xl ${
              settingsToast.type === "loading"
                ? "animate-pulse bg-cyan-100 text-cyan-600"
                : settingsToast.type === "success"
                ? "bg-emerald-100 text-emerald-600"
                : "bg-red-100 text-red-600"
            }`}>
              {settingsToast.type === "loading" ? "⏳" : settingsToast.type === "success" ? "✅" : "⚠️"}
            </div>

            <h2 className="mt-6 text-2xl font-black text-slate-950">
              {settingsToast.title}
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-500">
              {settingsToast.text}
            </p>

            {settingsToast.type === "loading" && (
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400 transition-all duration-150"
                  style={{ width: `${settingsProgress}%` }}
                />
              </div>
            )}

            {settingsToast.type === "loading" && (
              <div className="mt-3 text-xs font-black text-slate-500">
                {settingsProgress}% completed
              </div>
            )}
          </div>
        </div>
      )}



      {adminIpWarning && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-red-400/30 bg-slate-950 p-8 text-center text-white shadow-[0_0_100px_rgba(239,68,68,.35)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-cyan-400" />

            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/15 text-5xl shadow-[0_0_60px_rgba(239,68,68,.35)]">
              🛡️
            </div>

            <p className="mt-6 text-xs font-black tracking-[0.35em] text-red-300">
              NS.ai SECURITY PROTECTION
            </p>

            <h2 className="mt-3 text-4xl font-black">
              Administrator IP Detected
            </h2>

            <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed text-slate-300">
              This IP is currently assigned to the active administrator session.
              For security reasons, NS.ai does not allow blocking the current admin IP.
            </p>

            <div className="mt-6 grid gap-3 text-left text-sm font-black">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                IP: <span className="text-cyan-300">{currentAdminIp || "Current admin session"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Status: <span className="text-emerald-300">Protected</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Action: <span className="text-red-300">Block denied</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Risk: <span className="text-orange-300">Self lockout prevented</span>
              </div>
            </div>

            <button
              onClick={() => setAdminIpWarning(false)}
              className="mt-7 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-4 font-black text-white shadow-lg transition hover:scale-[1.02]"
            >
              Continue Monitoring
            </button>
          </div>
        </div>
      )}
      {selectedTwin && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-10 backdrop-blur-md">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/95 p-8 shadow-[0_35px_120px_rgba(15,23,42,.40)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400" />

            <button
              onClick={() => setSelectedTwin(null)}
              className="sticky ml-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg transition hover:scale-110 hover:bg-red-500"
            >
              ✕
            </button>

            <div className="pr-28">
              <p className="text-xs font-black tracking-[0.35em] text-cyan-600">NS.ai DIGITAL TWIN PROFILE</p>
              <h2 className="mt-2 text-4xl font-black text-slate-950">{selectedTwin.intent}</h2>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {selectedTwin.ip} • {selectedTwin.city}, {selectedTwin.country}
              </p>

              <div className={`mt-4 inline-flex rounded-full px-4 py-2 text-xs font-black ${
                selectedTwin.heat === "Risk" ? "bg-orange-100 text-orange-700" :
                selectedTwin.heat === "Hot" ? "bg-red-100 text-red-700" :
                selectedTwin.heat === "Warm" ? "bg-yellow-100 text-yellow-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {selectedTwin.heat} Visitor
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-4">
              {[
                ["Recruiter", selectedTwin.scores.recruiter],
                ["Client", selectedTwin.scores.client],
                ["Engagement", selectedTwin.scores.engagement],
                ["Threat", selectedTwin.scores.threat],
              ].map(([k, v]) => (
                <div key={k} className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
                  <p className="text-xs font-black text-slate-400">{k}</p>
                  <h3 className="mt-2 text-4xl font-black">{v}%</h3>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[2rem] border border-cyan-100 bg-cyan-50 p-6">
              <h3 className="text-xl font-black text-slate-950">🤖 NS.ai Recommendation</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{selectedTwin.recommendation}</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">System Intelligence</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {selectedTwin.browser} • {selectedTwin.os} • {selectedTwin.device}
                </p>
                <p className="mt-3 text-xs font-bold text-slate-400">
                  Visits: {selectedTwin.visits || 0} • Last seen: {selectedTwin.lastSeen ? new Date(selectedTwin.lastSeen).toLocaleString() : "Unknown"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">Visitor Journey</p>
                <div className="mt-3 space-y-2">
                  {(selectedTwin.pages || []).length === 0 && (
                    <p className="text-sm font-bold text-slate-500">Unknown</p>
                  )}
                  {(selectedTwin.pages || []).map((page, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-cyan-500" />
                      <span className="text-sm font-bold text-slate-700">{page}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSelectedTwin(null);
                  setActive("SOC Panel");
                }}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Open in SOC Panel
              </button>
              <button
                onClick={() => setSelectedTwin(null)}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
              >
                Continue Monitoring
              </button>
            </div>
          </div>
        </div>
      )}


      {selectedResumeDownload && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-white/40 bg-white p-8 shadow-[0_35px_120px_rgba(15,23,42,.40)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400" />

            <button
              onClick={() => setSelectedResumeDownload(null)}
              className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg transition hover:scale-110 hover:bg-red-500"
            >
              ✕
            </button>

            <p className="text-xs font-black tracking-[0.35em] text-cyan-600">
              RESUME DOWNLOAD INTELLIGENCE
            </p>

            <h2 className="mt-2 pr-16 text-4xl font-black text-slate-950">
              {selectedResumeDownload.ip || "Unknown IP"}
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-500">
              {selectedResumeDownload.city || "Unknown City"}, {selectedResumeDownload.country || "Unknown Country"}
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black text-slate-400">CITY</p>
                <h3 className="mt-2 text-2xl font-black">{selectedResumeDownload.city || "Unknown"}</h3>
              </div>
              <div className="rounded-3xl bg-slate-100 p-5">
                <p className="text-xs font-black text-slate-500">COUNTRY</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{selectedResumeDownload.country || "Unknown"}</h3>
              </div>
              <div className="rounded-3xl bg-emerald-50 p-5">
                <p className="text-xs font-black text-slate-500">DEVICE</p>
                <h3 className="mt-2 text-2xl font-black text-emerald-700">{selectedResumeDownload.device || "Desktop"}</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">System</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {selectedResumeDownload.browser || "Unknown"} • {selectedResumeDownload.os || "Unknown"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">Network</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  ISP: {selectedResumeDownload.isp || "Unknown"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">Downloaded From</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-500">
                  {selectedResumeDownload.page || "/"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-black text-slate-950">Downloaded At</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {selectedResumeDownload.createdAt ? new Date(selectedResumeDownload.createdAt).toLocaleString() : "Unknown"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[2rem] bg-cyan-50 p-6">
              <h3 className="text-xl font-black text-slate-950">🤖 NS.ai Lead Insight</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">
                This visitor downloaded your resume, which indicates strong recruiter, hiring, collaboration, or professional interest.
                Monitor this IP in visitor intelligence if repeated profile activity appears.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedSocIp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-md">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/30 bg-white p-7 shadow-[0_35px_120px_rgba(15,23,42,.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.35em] text-cyan-600">NS.ai IP INTELLIGENCE</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">{selectedSocIp.ip}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">Realtime SOC visitor investigation panel</p>
              </div>
              <button onClick={() => setSelectedSocIp(null)} className="rounded-full bg-red-500 px-4 py-2 font-black text-white">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black text-slate-400">REQUESTS / 30S</p>
                <h3 className="mt-2 text-4xl font-black">{selectedSocIp.requestsLast30s || 0}</h3>
              </div>
              <div className="rounded-3xl bg-slate-100 p-5">
                <p className="text-xs font-black text-slate-500">RISK SCORE</p>
                <h3 className="mt-2 text-4xl font-black text-slate-950">{selectedSocIp.score || 0}</h3>
              </div>
              <div className={`rounded-3xl p-5 ${selectedSocIp.blocked ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className="text-xs font-black text-slate-500">STATUS</p>
                <h3 className={`mt-2 text-2xl font-black ${selectedSocIp.blocked ? "text-red-700" : "text-emerald-700"}`}>
                  {selectedSocIp.blocked ? "Blocked" : "Allowed"}
                </h3>
              </div>
            </div>

            <div className="mt-5 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-black text-slate-950">NS.ai Analysis</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">
                {selectedSocIp.score >= 80
                  ? "Critical traffic behavior detected. Recommended action: temporary block or panic mode if traffic continues."
                  : selectedSocIp.score >= 55
                  ? "High suspicious request pattern detected. Monitor closely and consider temporary block."
                  : selectedSocIp.requestsLast30s >= 15
                  ? "Elevated traffic activity detected. Keep monitoring this IP."
                  : "No major suspicious activity detected. IP looks normal right now."}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {["1h", "6h", "24h", "7d", "permanent"].map((d) => (
                <button
                  key={d}
                  onClick={() => blockVisitorIp(selectedSocIp.ip, d)}
                  className={`rounded-2xl px-4 py-3 text-xs font-black text-white ${
                    selectedSocIp.ip === currentAdminIp ? "bg-slate-700 opacity-70" : "bg-red-600"
                  }`}
                >
                  Block {d}
                </button>
              ))}
            </div>

            {selectedSocIp.blocked && (
              <button
                onClick={() => unblockVisitorIp(selectedSocIp.ip)}
                className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white"
              >
                Unblock IP
              </button>
            )}
          </div>
        </div>
      )}

      {!menuHidden && active !== "NS.ai" && (
      <Sidebar
        menu={menu}
        active={active}
        setActive={(tab) => {
          if (tab === "NS.ai") openNsaiWithIntro();
          else setActive(tab);
        }}
        unreadMessages={data?.unreadMessages || 0}
        unreadMessages={data?.unreadMessages || 0}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      )}

      <main className={`min-w-0 p-4 sm:p-5 md:p-8 ${menuHidden || active === "NS.ai" ? "" : "lg:ml-72"}`}>
        {active !== "NS.ai" && (
        <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-2xl bg-white p-3 text-xl shadow-sm lg:hidden"
            >
              <FiMenu />
            </button>

            <div>
              <p className="text-sm font-black text-slate-500">{active}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                Portfolio Dashboard
              </h1>
              <p className="mt-2 text-slate-500">
                Real-time analytics, visitors, Earth view and contact CRM.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setLiveRefresh(!liveRefresh)}
              className={`rounded-2xl px-4 py-3 text-sm font-black shadow-sm ${
                liveRefresh ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500"
              }`}
            >
              {liveRefresh ? "Live Refresh ON" : "Live Refresh OFF"}
            </button>

            <button
              type="button"
              onClick={toggleMenuHidden}
              className="HEADER_MENU_TOGGLE_FINAL flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:scale-105 active:scale-95"
            >
              {menuHidden ? "☰ Show Menu" : "✕ Hide Menu"}
            </button>

            <button
              type="button"
              onClick={toggleThemeMode}
              className="PREMIUM_THEME_TOGGLE_BTN flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:scale-105 active:scale-95"
            >
              <span className={`flex h-6 w-11 items-center rounded-full p-1 transition ${theme === "dark" ? "bg-slate-950" : "bg-slate-200"}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transition ${theme === "dark" ? "translate-x-5" : "translate-x-0"}`} />
              </span>
              {theme === "dark" ? "Dark" : "Light"}
            </button>

            <div className="relative">
              <button
                onClick={() => setAlertsOpen(!alertsOpen)}
                className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm"
              >
                🔔 Alerts
                {alertCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-black text-white">
                    {alertCount}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 top-14 z-[999] w-96 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white text-slate-950 shadow-2xl">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
                    <div>
                      <h3 className="text-lg font-black">AI Alert Center</h3>
                      <p className="text-xs font-bold text-slate-500">Live admin intelligence alerts</p>
                    </div>

                    <button
                      onClick={() => setAlertsCleared(true)}
                      className="rounded-full bg-red-500 px-4 py-2 text-xs font-black text-white shadow-sm"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3">
                    {(alertsCleared || alertItems.length === 0) && (
                      <div className="rounded-2xl bg-emerald-50 p-5 text-center">
                        <p className="text-3xl">🛡️</p>
                        <p className="mt-2 text-lg font-black text-emerald-700">
                          Your portfolio is secure
                        </p>
                        <p className="mt-1 text-sm font-bold text-emerald-600">
                          No active alerts right now. NS.ai is monitoring visitors, messages and security logs.
                        </p>
                      </div>
                    )}

                    {!alertsCleared && alertItems.map((a, i) => (
                      <div key={i} className="mb-2 rounded-2xl bg-slate-50 p-4">
                        <div className="flex gap-3">
                          <span className="text-2xl">{a.icon}</span>
                          <div>
                            <p className="font-black">{a.title}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{a.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => window.open("https://naitiksoni1417.netlify.app", "_blank")}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              <FiExternalLink /> Portfolio
            </button>

            <button
              onClick={() => window.open("https://mail.google.com/mail/u/0/#inbox", "_blank")}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm"
            >
              <FiMail /> Mail
            </button>

            <button
              onClick={loadDashboard}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black shadow-sm"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              <FiLogOut /> Logout
            </button>
          </div>
        </header>

        )}
        {active !== "NS.ai" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-2">
            <FiClock /> Last sync: {lastSync ? lastSync.toLocaleString() : "Loading..."}
          </span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">
            API: {API_URL.replace("https://", "")}
          </span>
        </div>

        )}
        {active !== "NS.ai" && (
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([title, value, icon, note]) => (
            <div key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  {icon}
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">
                  Live
                </span>
              </div>
              <p className="mt-6 text-sm font-bold text-slate-500">{title}</p>
              <h2 className="mt-2 text-4xl font-black">{value}</h2>
              <p className="mt-2 text-xs font-semibold text-slate-400">{note}</p>
            </div>
          ))}
        </section>
        )}
        {active === "Digital Twin Lab" && (
          <section className="mt-6 min-w-0 space-y-6">
            <div className="rounded-[2.5rem] border border-cyan-300/20 bg-slate-950 p-8 text-white shadow-2xl">
              <p className="text-xs font-black tracking-[0.4em] text-cyan-300">NS.ai BEHAVIOR INTELLIGENCE</p>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">Digital Twin Lab</h2>
              <p className="mt-3 max-w-3xl text-sm font-bold text-slate-400">
                AI-style visitor profiling: recruiter probability, client intent, engagement score, suspicious behavior and smart recommendations.
              </p>
            </div>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Analysed", digitalTwinData?.totalAnalysed || 0],
                ["Hot Leads", digitalTwinData?.hotLeads || 0],
                ["Recruiters", digitalTwinData?.recruiters || 0],
                ["Clients", digitalTwinData?.clients || 0],
                ["Suspicious", digitalTwinData?.suspicious || 0],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-black text-slate-500">{k}</p>
                  <h3 className="mt-3 text-4xl font-black text-slate-950">{v}</h3>
                </div>
              ))}
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              {(digitalTwinData?.twins || []).map((twin) => (
                <button
                  key={twin.ip}
                  onClick={() => setSelectedTwin(twin)}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.25em] text-cyan-600">VISITOR DIGITAL TWIN</p>
                      <h3 className="mt-2 text-2xl font-black text-slate-950">{twin.intent}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">{twin.ip} • {twin.city}, {twin.country}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {twin.scores.recruiter >= 80 && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            🟢 Recruiter Detected
                          </span>
                        )}
                        {twin.scores.client >= 80 && (
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">
                            💰 Potential Client
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      twin.heat === "Hot" ? "bg-red-100 text-red-700" :
                      twin.heat === "Warm" ? "bg-yellow-100 text-yellow-700" :
                      twin.heat === "Risk" ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {twin.heat}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {[
                      ["Recruiter", twin.scores.recruiter],
                      ["Client", twin.scores.client],
                      ["Engagement", twin.scores.engagement],
                      ["Threat", twin.scores.threat],
                    ].map(([label, score]) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs font-black text-slate-500">
                          <span>{label}</span><span>{score}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 text-sm font-bold text-slate-600">{twin.recommendation}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {active === "SOC Panel" && (
          <section className="mt-6 min-w-0 space-y-6">
            <div className={`rounded-[2.5rem] border p-7 text-white shadow-2xl transition-all duration-500 ${
              socData?.threatLevel === "CRITICAL" ? "border-red-400 bg-gradient-to-br from-red-950 via-slate-950 to-black shadow-red-500/30 animate-pulse" :
              socData?.threatLevel === "HIGH" ? "border-orange-400 bg-gradient-to-br from-orange-950 via-slate-950 to-black shadow-orange-500/20" :
              socData?.threatLevel === "MEDIUM" ? "border-yellow-400 bg-gradient-to-br from-yellow-950 via-slate-950 to-black shadow-yellow-500/20" :
              "border-cyan-300/20 bg-slate-950"
            }`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.35em] text-cyan-300">NS.ai SECURITY OPERATIONS CENTER</p>
                  <h2 className="mt-3 text-4xl font-black">Advanced SOC Panel</h2>
                  <p className="mt-2 max-w-2xl text-sm font-bold text-slate-400">
                    Real-time DoS detection, auto-block firewall, panic mode, attack feed, world threat map and security analytics.
                  </p>
                </div>

                <button
                  onClick={toggleSocLockdown}
                  className={`rounded-[2rem] px-7 py-5 text-center font-black shadow-xl transition hover:scale-105 ${
                    socData?.emergencyLockdown ? "bg-emerald-500 text-white" : "bg-red-600 text-white"
                  }`}
                >
                  🚨 {socData?.emergencyLockdown ? "PANIC MODE ON" : "ENABLE PANIC MODE"}
                </button>

                <div className="rounded-[2rem] bg-white/10 px-6 py-5 text-center">
                  <p className="text-xs font-black">THREAT LEVEL</p>
                  <h3 className="mt-1 text-3xl font-black">{socData?.threatLevel || "LOW"}</h3>
                  <p className="text-xs font-bold">Score: {socData?.threatScore || 0}/100</p>
                </div>
              </div>
            </div>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Threat Score", socData?.threatScore || 0, "Live SOC risk"],
                ["Security Score", socData?.securityScore ?? 100, "Portfolio protection"],
                ["Active IPs", socData?.activeIps || 0, "Tracked now"],
                ["Blocked IPs", socData?.blockedIps?.length || 0, "Firewall blocked"],
                ["Events", socData?.events?.length || 0, "Live attack feed"],
              ].map(([title, value, note]) => (
                <div key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1">
                  <p className="text-sm font-black text-slate-500">{title}</p>
                  <h3 className="mt-3 text-4xl font-black text-slate-950">{value}</h3>
                  <p className="mt-2 text-xs font-bold text-slate-400">{note}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2" title="Auto Block Firewall" desc="Top request IPs with real-time block controls" icon={<FiShield />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr><th className="py-3">IP</th><th>Req / 30s</th><th>Score</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {(socData?.topIps || []).map((ip) => (
                        <tr key={ip.ip} className="border-t border-slate-100">
                          <td className="py-4">
                            <button
                              onClick={() => setSelectedSocIp(ip)}
                              className="font-black text-slate-950 underline decoration-cyan-400 decoration-2 underline-offset-4 hover:text-cyan-600"
                            >
                              {ip.ip}
                              {ip.ip === currentAdminIp && (
                                <span className="ml-2 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black text-cyan-700">
                                  ADMIN
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="font-bold">{ip.requestsLast30s}</td>
                          <td className="font-bold">{ip.score}</td>
                          <td><span className={`rounded-full px-3 py-1 text-xs font-black ${ip.blocked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{ip.blocked ? "Blocked" : "Allowed"}</span></td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <select
                                value={selectedBlockDuration}
                                onChange={(e) => setSelectedBlockDuration(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-black"
                              >
                                <option value="1h">1 Hour</option>
                                <option value="6h">6 Hours</option>
                                <option value="24h">24 Hours</option>
                                <option value="7d">7 Days</option>
                                <option value="permanent">Permanent</option>
                              </select>

                              {ip.ip === currentAdminIp ? (
                                <button
                                  onClick={() => setAdminIpWarning(true)}
                                  className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black text-white opacity-80"
                                >
                                  🔒 Protected
                                </button>
                              ) : ip.blocked ? (
                                <button onClick={() => unblockVisitorIp(ip.ip)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Unblock</button>
                              ) : (
                                <button onClick={() => blockVisitorIp(ip.ip)} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white">Block IP</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Security Score" desc="Portfolio protection health" icon={<FiActivity />}>
                <div className="rounded-[2rem] bg-slate-950 p-6 text-center text-white">
                  <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-emerald-400 text-4xl font-black">
                    {socData?.securityScore ?? 100}
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-300">{socData?.recommendation}</p>
                </div>
              </Card>

              <Card title="Blocked IP Manager" desc="Unblock blocked visitors" icon={<FiShield />}>
                <div className="max-h-72 overflow-y-auto space-y-3">
                  {(socData?.blockedIps || []).length === 0 && (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                      No blocked IPs right now.
                    </p>
                  )}

                  {(socData?.blockedIps || []).map((item, i) => (
                    <div key={`${item.ip}-${i}`} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="font-black text-red-700">
                        {item.ip}
                        {item.ip === currentAdminIp && (
                          <span className="ml-2 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black text-cyan-700">
                            CURRENT ADMIN
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs font-bold text-red-500">
                        {item.expiresAt ? `Expires: ${new Date(item.expiresAt).toLocaleString()}` : "Permanent block"}
                      </p>
                      <button
                        onClick={() => unblockVisitorIp(item.ip)}
                        className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white"
                      >
                        Unblock IP
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="World Attack Map 🌍" desc="Country-wise threat visibility from live visitor intelligence" icon={<FiGlobe />}>
                <div className="grid gap-3">
                  {(socData?.geoThreats || []).map((g) => (
                    <div key={g.country} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-950">🌍 {g.country}</p>
                          <p className="text-xs font-bold text-slate-500">{g.topCity} • {g.topBrowser}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${g.risk === "HIGH" ? "bg-red-100 text-red-700" : g.risk === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>{g.risk}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${Math.min(100, g.requests)}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-black text-slate-500">{g.requests} requests / 24h</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Attack Analytics Chart" desc="Suspicious, blocked and critical events trend" icon={<FiTrendingUp />}>
                <div className="space-y-4">
                  {(socData?.attackTrend || []).length === 0 && <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">No attack trend yet.</p>}
                  {(socData?.attackTrend || []).map((x) => (
                    <div key={x.time}>
                      <div className="flex justify-between text-xs font-black text-slate-500">
                        <span>{x.time}</span><span>S:{x.suspicious} B:{x.blocked} C:{x.critical}</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600" style={{ width: `${Math.min(100, (x.suspicious + x.blocked + x.critical) * 18)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card title="Live Attack Feed" desc="Real-time SOC security timeline" icon={<FiShield />}>
              <div className="max-h-[430px] overflow-y-auto">
                {(socData?.events || []).length === 0 && <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">No SOC events yet. System is clean.</p>}
                {(socData?.events || []).map((e, i) => (
                  <div key={i} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-black text-slate-950">{e.type}</p><p className="mt-1 text-sm font-bold text-slate-500">{e.reason}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${e.severity === "CRITICAL" ? "bg-red-100 text-red-700" : e.severity === "HIGH" ? "bg-orange-100 text-orange-700" : e.severity === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>{e.severity}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-400">IP: {e.ip} • Path: {e.path} • {new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}


        {active === "Settings" && (
          <section className="mt-6 min-w-0 space-y-6">
            {settingsStatus && (
              <div className="hidden rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 font-black text-emerald-700 shadow-sm">
                {settingsStatus}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <Card title="Admin Profile" desc="Owner identity and admin information" icon={<FiShield />}>
                <div className="grid gap-4">
                  <input
                    value={adminSettings?.adminProfile?.name || ""}
                    onChange={(e) => setAdminSettings({ ...adminSettings, adminProfile: { ...(adminSettings?.adminProfile || {}), name: e.target.value } })}
                    placeholder="Admin name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none"
                  />
                  <input
                    value={adminSettings?.adminProfile?.email || ""}
                    onChange={(e) => setAdminSettings({ ...adminSettings, adminProfile: { ...(adminSettings?.adminProfile || {}), email: e.target.value } })}
                    placeholder="Admin email"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none"
                  />
                  <input
                    value={adminSettings?.adminProfile?.role || ""}
                    onChange={(e) => setAdminSettings({ ...adminSettings, adminProfile: { ...(adminSettings?.adminProfile || {}), role: e.target.value } })}
                    placeholder="Admin role"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none"
                  />
                  <button onClick={() => saveAdminSettings({ adminProfile: adminSettings?.adminProfile })} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                    Save Profile
                  </button>
                </div>
              </Card>

              <Card title="Password + Security" desc="Secure password update" icon={<FiShield />}>
                <div className="grid gap-4">
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none" />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none" />
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    Strength: {newPassword.length >= 10 ? "Strong ✅" : newPassword.length >= 6 ? "Medium ⚠️" : "Weak ❌"}
                  </div>
                  <button onClick={changeAdminPasswordSecure} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                    Update Password
                  </button>
                </div>
              </Card>

              <Card title="Report Settings" desc="Mail report controls" icon={<FiMail />}>
                <div className="grid gap-4">
                  <label className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black">
                    Daily Report
                    <input type="checkbox" checked={adminSettings?.reportSettings?.enabled !== false} onChange={(e) => setAdminSettings({ ...adminSettings, reportSettings: { ...(adminSettings?.reportSettings || {}), enabled: e.target.checked } })} />
                  </label>
                  <input value={adminSettings?.reportSettings?.reportEmail || ""} onChange={(e) => setAdminSettings({ ...adminSettings, reportSettings: { ...(adminSettings?.reportSettings || {}), reportEmail: e.target.value } })} placeholder="Report email" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none" />
                  <input type="time" value={adminSettings?.reportSettings?.reportTime || "21:00"} onChange={(e) => setAdminSettings({ ...adminSettings, reportSettings: { ...(adminSettings?.reportSettings || {}), reportTime: e.target.value } })} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none" />
                  <button onClick={() => saveAdminSettings({ reportSettings: adminSettings?.reportSettings })} className="rounded-2xl bg-cyan-600 px-5 py-4 font-black text-white">
                    Save Report Settings
                  </button>
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card title="NS.ai Settings" desc="AI language, tone and voice" icon={<FiActivity />}>
                <div className="grid gap-4">
                  <select value={adminSettings?.nsaiSettings?.language || "Hinglish"} onChange={(e) => setAdminSettings({ ...adminSettings, nsaiSettings: { ...(adminSettings?.nsaiSettings || {}), language: e.target.value } })} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black">
                    <option>Hinglish</option><option>Gujarati</option><option>Hindi</option><option>English</option>
                  </select>
                  <select value={adminSettings?.nsaiSettings?.tone || "Professional"} onChange={(e) => setAdminSettings({ ...adminSettings, nsaiSettings: { ...(adminSettings?.nsaiSettings || {}), tone: e.target.value } })} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black">
                    <option>Professional</option><option>Friendly</option><option>Short</option><option>Detailed</option>
                  </select>
                  <label className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black">
                    Voice Mode
                    <input type="checkbox" checked={adminSettings?.nsaiSettings?.voice !== false} onChange={(e) => setAdminSettings({ ...adminSettings, nsaiSettings: { ...(adminSettings?.nsaiSettings || {}), voice: e.target.checked } })} />
                  </label>
                  <button onClick={() => saveAdminSettings({ nsaiSettings: adminSettings?.nsaiSettings })} className="rounded-2xl bg-violet-600 px-5 py-4 font-black text-white">
                    Save NS.ai Settings
                  </button>
                </div>
              </Card>

              <Card title="Alert Settings" desc="Live notification controls" icon={<FiMail />}>
                <div className="grid gap-4">
                  {[
                    ["failedLoginAlerts", "Failed Login Alerts"],
                    ["messageAlerts", "New Message Alerts"],
                    ["visitorAlerts", "New Visitor Alerts"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black">
                      {label}
                      <input type="checkbox" checked={adminSettings?.alertSettings?.[key] !== false} onChange={(e) => setAdminSettings({ ...adminSettings, alertSettings: { ...(adminSettings?.alertSettings || {}), [key]: e.target.checked } })} />
                    </label>
                  ))}
                  <button onClick={() => saveAdminSettings({ alertSettings: adminSettings?.alertSettings })} className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">
                    Save Alert Settings
                  </button>
                </div>
              </Card>

              <Card title="Theme Settings" desc="Dashboard theme controls" icon={<FiShield />}>
                <div className="grid gap-4">
                  <div className="rounded-2xl bg-slate-50 p-4 font-black">Current Theme: {theme}</div>
                  <button onClick={toggleThemeMode} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                    Toggle Light / Dark
                  </button>
                  <select value={adminSettings?.themeSettings?.accent || "cyan"} onChange={(e) => setAdminSettings({ ...adminSettings, themeSettings: { ...(adminSettings?.themeSettings || {}), accent: e.target.value } })} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black">
                    <option value="cyan">Cyan</option><option value="emerald">Emerald</option><option value="violet">Violet</option><option value="rose">Rose</option>
                  </select>
                  <label className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 font-black">
                    Glass Effect
                    <input type="checkbox" checked={adminSettings?.themeSettings?.glass !== false} onChange={(e) => setAdminSettings({ ...adminSettings, themeSettings: { ...(adminSettings?.themeSettings || {}), glass: e.target.checked } })} />
                  </label>
                  <button onClick={() => saveAdminSettings({ themeSettings: adminSettings?.themeSettings })} className="rounded-2xl bg-slate-700 px-5 py-4 font-black text-white">
                    Save Theme Settings
                  </button>
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Privacy / Data" desc="Export and local privacy tools" icon={<FiShield />}>
                <div className="grid gap-4">
                  <button onClick={exportVisitorsCSV} className="rounded-2xl bg-white px-5 py-4 font-black text-slate-950 shadow-sm">Export Visitors CSV</button>
                  <button onClick={exportMessagesCSV} className="rounded-2xl bg-white px-5 py-4 font-black text-slate-950 shadow-sm">Export Messages CSV</button>
                  <button onClick={() => { localStorage.removeItem("nsai_chat_history"); setSettingsStatus("NS.ai local chat history cleared ✅"); }} className="rounded-2xl bg-slate-100 px-5 py-4 font-black text-slate-700">Clear NS.ai Local Chat History</button>
                </div>
              </Card>

              <Card title="Danger Zone" desc="Permanent reset with confirmation" icon={<FiShield />}>
                <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6">
                  <h3 className="text-2xl font-black text-red-700">Clear / Reset Admin Data</h3>
                  <p className="mt-2 text-sm font-bold text-red-600">
                    This will permanently clear visitors, messages and security logs. Password and settings will stay safe.
                  </p>
                  <input
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="Type RESET DATA"
                    className="mt-5 w-full rounded-2xl border border-red-200 bg-white px-5 py-4 font-black text-red-700 outline-none"
                  />
                  <button onClick={resetAllAdminData} className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white shadow-lg">
                    Danger: Clear All Data
                  </button>
                </div>
              </Card>
            </div>
          </section>
        )}

        {active === "Overview" && (
          <>
            <section className="mt-6 grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2" title="Weekly Traffic" desc="Views from the last 7 days" icon={<FiTrendingUp />}>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyViews}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Area type="monotone" dataKey="views" stroke="#020617" fill="#e2e8f0" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Device Split" desc="Visitor device categories" icon={<FiSmartphone />}>
                <PieChartBox data={devices} />
              </Card>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-4">
              <Card className="xl:col-span-2" title="Top Pages" desc="Most visited routes" icon={<FiGlobe />}>
                <BarChartBox data={topPages} dataKey="page" />
              </Card>

              <Card title="Top Countries" desc="Visitor country ranking" icon={<FiGlobe />}>
                <Ranking data={countries} />
              </Card>

              <Card title="Top Cities" desc="Visitor city ranking" icon={<FiActivity />}>
                <Ranking data={cities} />
              </Card>
            </section>
          </>
        )}

        {active === "Visitors" && (
          <VisitorsTable
            visitors={visitors}
            query={query}
            setQuery={setQuery}
            exportVisitorsCSV={exportVisitorsCSV}
            adminIp={adminIp}
            adminIp={adminIp}
            setSelectedVisitor={setSelectedVisitor}
          />
        )}

        {active === "Messages" && (
          <Messages
            messages={messages}
            exportMessagesCSV={exportMessagesCSV}
            updateMessageStatus={updateMessageStatus}
            deleteMessage={deleteMessage}
            token={token}
            loadDashboard={loadDashboard}
          />
        )}

        {active === "Resume Downloads" && (
          <section className="mt-6 min-w-0 space-y-6">
            <div className="rounded-[2.5rem] border border-cyan-300/20 bg-slate-950 p-8 text-white shadow-2xl">
              <p className="text-xs font-black tracking-[0.35em] text-cyan-300">RESUME INTELLIGENCE</p>
              <h2 className="mt-3 text-4xl font-black">Resume Downloads</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold text-slate-400">
                Track who downloaded your resume with IP, city, country, browser, device, ISP and timestamp.
              </p>
            </div>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Total Downloads", resumeData?.total || 0, "All-time resume clicks"],
                ["Today Downloads", resumeData?.todayCount || 0, "Downloaded today"],
                ["Top Countries", resumeData?.countries?.length || 0, "Country sources"],
                ["Recent Records", resumeData?.recent?.length || 0, "Latest downloaders"],
              ].map(([title, value, note]) => (
                <div key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1">
                  <p className="text-sm font-black text-slate-500">{title}</p>
                  <h3 className="mt-3 text-4xl font-black text-slate-950">{value}</h3>
                  <p className="mt-2 text-xs font-bold text-slate-400">{note}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2" title="Recent Resume Downloaders" desc="Click any IP to open SaaS intelligence popup" icon={<FiActivity />}>
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={exportResumeDownloadsCSV}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="py-3">IP</th>
                        <th>Location</th>
                        <th>Device</th>
                        <th>Browser</th>
                        <th>Downloaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resumeData?.recent || []).map((r, i) => (
                        <tr key={r._id || i} className="border-t border-slate-100">
                          <td className="py-4">
                            <button
                              onClick={() => setSelectedResumeDownload(r)}
                              className="font-black text-slate-950 underline decoration-cyan-400 decoration-2 underline-offset-4 hover:text-cyan-600"
                            >
                              {r.ip || "Unknown"}
                            </button>
                          </td>
                          <td className="font-bold text-slate-600">
                            {r.city || "Unknown"}, {r.country || "Unknown"}
                          </td>
                          <td className="font-bold text-slate-600">{r.device || "Desktop"}</td>
                          <td className="font-bold text-slate-600">{r.browser || "Unknown"}</td>
                          <td className="text-slate-500">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Unknown"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {(resumeData?.recent || []).length === 0 && (
                    <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">No resume downloads yet.</p>
                  )}
                </div>
              </Card>

              <Card title="Top Locations" desc="Where resume interest is coming from" icon={<FiGlobe />}>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-3 font-black text-slate-950">Countries</h3>
                    <Ranking data={resumeData?.countries || []} />
                  </div>
                  <div>
                    <h3 className="mb-3 font-black text-slate-950">Cities</h3>
                    <Ranking data={resumeData?.cities || []} />
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {active === "Analytics" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Page Performance" desc="Route level tracking" icon={<FiBarChart2 />}>
              <BarChartBox data={topPages} dataKey="page" height="h-96" />
            </Card>

            <Card title="Traffic Timeline" desc="Weekly growth pattern" icon={<FiTrendingUp />}>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyViews}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="views" stroke="#020617" fill="#e2e8f0" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Countries" desc="Top countries" icon={<FiGlobe />}>
              <Ranking data={countries} />
            </Card>

            <Card title="Cities" desc="Top cities" icon={<FiActivity />}>
              <Ranking data={cities} />
            </Card>
          </section>
        )}

        {active === "Security Logs" && (
          <SecurityLogs
            analytics={advancedAnalytics}
            reloadSecurity={loadAdvancedAnalytics}
          />
        )}

        {active === "Devices" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card title="Devices" desc="Device category usage" icon={<FiSmartphone />}>
              <Ranking data={devices.map((d) => ({ _id: d.name, count: d.value }))} />
            </Card>

            <Card title="Browsers" desc="Client browser data" icon={<FiGlobe />}>
              <Ranking data={browsers} />
            </Card>

            <Card title="Operating Systems" desc="OS usage breakdown" icon={<FiGrid />}>
              <Ranking data={osStats} />
            </Card>
          </section>
        )}

        {active === "NS.ai" && (
          <NSAIChat
            data={data}
            security={advancedAnalytics}
            token={token}
            loadDashboard={loadDashboard}
            loadAdvancedAnalytics={loadAdvancedAnalytics}
            theme={theme}
            toggleThemeMode={toggleThemeMode}
            logout={logout}
            setActive={setActive}
          />
        )}

        {active === "Earth View" && (
          <section className="mt-6">
            <EarthView visitors={data?.recentVisitors || []} />
          </section>
        )}
      </main>

      {selectedVisitor && (
        <VisitorProfileModal
          visitor={selectedVisitor}
          onClose={() => setSelectedVisitor(null)}
        />
      )}
    </div>
  );
}

function VisitorProfileModal({ visitor, onClose }) {
  const mapsUrl =
    visitor.lat && visitor.lng
      ? `https://www.google.com/maps?q=${visitor.lat},${visitor.lng}`
      : `https://www.google.com/search?q=${visitor.ip}+ip+lookup`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2.2rem] border border-white/70 bg-white p-6 text-slate-950 shadow-2xl">
        <div className="absolute right-[-90px] top-[-90px] h-72 w-72 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute bottom-[-90px] left-[-90px] h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.25em] text-emerald-600">
              VISITOR INTELLIGENCE
            </p>
            <h2 className="mt-2 text-4xl font-black">{visitor.ip || "Unknown IP"}</h2>
            <p className="mt-2 font-bold text-slate-500">
              {visitor.isReturning ? "Returning Visitor" : "New Visitor"} • {visitor.visits || 1} visits
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 p-3 text-xl hover:bg-slate-200"
          >
            <FiX />
          </button>
        </div>

        <div className="relative mt-6 grid gap-4 md:grid-cols-3">
          <VisitorBox title="Location" value={`${visitor.city || "Unknown"}, ${visitor.region || ""} ${visitor.country || "Unknown"}`} />
          <VisitorBox title="ISP / Network" value={visitor.isp || "Unknown"} />
          <VisitorBox title="Device" value={visitor.device || "Desktop"} />
          <VisitorBox title="Operating System" value={visitor.os || "Unknown"} />
          <VisitorBox title="Browser" value={visitor.browser || "Unknown"} />
          <VisitorBox title="Page" value={visitor.page || "/"} />
          <VisitorBox title="First / Last Seen" value={visitor.createdAt ? new Date(visitor.createdAt).toLocaleString() : "Unknown"} />
          <VisitorBox title="Latitude" value={visitor.lat || "Unknown"} />
          <VisitorBox title="Longitude" value={visitor.lng || "Unknown"} />
        </div>

        <div className="relative mt-6 rounded-[1.7rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black tracking-[0.2em] text-slate-400">USER AGENT</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-200">
            {visitor.userAgent || "Not captured"}
          </p>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-3">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Open Location / IP Lookup
          </a>

          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitorBox({ title, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}







function NSAIChat({
  data,
  security,
  token,
  loadDashboard,
  loadAdvancedAnalytics,
  theme,
  toggleThemeMode,
  logout,
  setActive,
}) {
  const isDark = theme === "dark";
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const placeholderTexts = [
    "Ask about traffic, visitors, devices, messages or security logs...",
    "Ask NS.ai • Visitors • Traffic • Messages • Security • Growth",
    "Try: Show me today's visitor report...",
    "Try: Did anyone access my admin panel today?",
    "Ask NS.ai to generate a CEO-style daily report..."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("Tap the mic and speak with NS.ai");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nsai_chat_history") || "[]");
    } catch {
      return [];
    }
  });

  const chatStarted = messages.length > 0;

  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard?.();
      loadAdvancedAnalytics?.();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const askAI = async (q = input, speakMode = false) => {
    if (!q.trim()) return;

    const lowerQ = q.toLowerCase();

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");

    const speakNow = (text) => {
      if (!speakMode || !("speechSynthesis" in window)) return;
      const clean = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#/g, "").replace(/`/g, "").replace(/\n/g, ". ");
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = "en-IN";
      utter.rate = 0.92;
      utter.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    };

    if ((lowerQ.includes("visitor") || lowerQ.includes("visitors") || lowerQ.includes("વીઝિટર")) &&
        (lowerQ.includes("today") || lowerQ.includes("aaje") || lowerQ.includes("આજે"))) {
      const ans = `Bhai, aaje tara portfolio par ${data?.todayViews || 0} views aavya che. Total visitors ${data?.totalVisitors || 0} che, ane active sessions currently ${data?.activeSessions || 0} che.`;
      setMessages((prev) => [...prev, { role: "ai", text: ans }]);
      speakNow(ans);
      return;
    }
    setThinking(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/ns-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: q,
          dashboard: {
            totalVisitors: data?.totalVisitors || 0,
            todayViews: data?.todayViews || 0,
            activeSessions: data?.activeSessions || 0,
            totalMessages: data?.totalMessages || 0,
            unreadMessages: data?.unreadMessages || 0,
            dailyViews: (data?.dailyViews || []).slice(-7),
            countries: (data?.countries || []).slice(0, 6),
            cities: (data?.cities || []).slice(0, 6),
            browsers: (data?.browsers || []).slice(0, 6),
            devices: (data?.devices || []).slice(0, 6),
            osStats: (data?.osStats || []).slice(0, 6),
            topPages: (data?.topPages || []).slice(0, 6),
            messages: (data?.messages || []).slice(0, 5).map((m) => ({
              name: m.name,
              email: m.email,
              message: m.message,
              status: m.status,
              city: m.city,
              country: m.country,
              createdAt: m.createdAt,
            })),
          },
          security: {
            failedLoginCount: security?.failedLoginCount || 0,
            blockedIps: security?.blockedIps?.length || 0,
            suspiciousIps: (security?.suspiciousIps || []).slice(0, 5),
            logs: (security?.logs || []).slice(0, 8).map((l) => ({
              ip: l.ip,
              action: l.action,
              reason: l.reason,
              attempts: l.attempts,
              city: l.city,
              country: l.country,
              browser: l.browser,
              os: l.os,
              createdAt: l.createdAt,
            })),
          },
        }),
      });

      const result = await res.json();

      const aiText = result.answer || result.error || "NS.ai could not answer right now.";

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: aiText,
        },
      ]);

      if ((voiceOpen || speakMode) && "speechSynthesis" in window) {
        setVoiceText(aiText);

        const speakText = aiText
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/#/g, "")
          .replace(/`/g, "")
          .replace(/_/g, " ")
          .replace(/\[(.*?)\]\(.*?\)/g, "$1")
          .replace(/\n{2,}/g, ". ")
          .replace(/\n/g, ". ")
          .replace(/\s+/g, " ")
          .trim();

        const utter = new SpeechSynthesisUtterance(speakText);
        utter.lang = /[\u0A80-\u0AFF]/.test(aiText) ? "gu-IN" : /[\u0900-\u097F]/.test(aiText) ? "hi-IN" : "en-IN";
        utter.rate = 0.95;
        utter.pitch = 1;
        utter.volume = 1;

        utter.onstart = () => setVoiceText("NS.ai is speaking...");
        utter.onend = () => setVoiceText("Done. Tap Speak Again to continue.");

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "NS.ai connection failed. Please check backend deployment." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const saveCurrentChat = () => {
    if (!messages.length) return;

    const item = {
      id: Date.now(),
      title: messages[0]?.text?.slice(0, 60) || "NS.ai Chat",
      messages,
      createdAt: new Date().toLocaleString("en-IN"),
    };

    const updated = [item, ...chatHistory].slice(0, 30);
    setChatHistory(updated);
    localStorage.setItem("nsai_chat_history", JSON.stringify(updated));
  };

  const startNewChat = () => {
    saveCurrentChat();
    setMessages([]);
    setInput("");
  };

  const openSavedChat = (item) => {
    setMessages(item.messages || []);
    setHistoryOpen(false);
  };

  const deleteSavedChat = (id) => {
    const updated = chatHistory.filter((x) => x.id !== id);
    setChatHistory(updated);
    localStorage.setItem("nsai_chat_history", JSON.stringify(updated));
  };

  useEffect(() => {
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const type = () => {
      const current = placeholderTexts[placeholderIndex];

      if (!deleting) {
        setTypedPlaceholder(current.slice(0, charIndex + 1));
        charIndex++;

        if (charIndex === current.length) {
          deleting = true;
          timeoutId = setTimeout(type, 1400);
          return;
        }
      } else {
        setTypedPlaceholder(current.slice(0, charIndex - 1));
        charIndex--;

        if (charIndex === 0) {
          deleting = false;
          setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
          return;
        }
      }

      timeoutId = setTimeout(type, deleting ? 25 : 38);
    };

    type();

    return () => clearTimeout(timeoutId);
  }, [placeholderIndex]);

  const sendReportOnMail = async () => {
    setMessages((prev) => [...prev, { role: "ai", text: "Bhai, NS.ai daily report email send kari rahyo chu..." }]);

    try {
      const res = await fetch(`${API_URL}/api/admin/send-daily-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: result.success
            ? "Done bhai ✅ NS.ai report mail par send thai gayo. Inbox/Spam check kar."
            : `Report send failed: ${result.details || result.error || "Unknown error"}`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Report mail send failed: ${err.message || "Network/API error"}. Render backend logs check kar.`,
        },
      ]);
    }
  };

  const quick = [
    ["Overview", "Give me today's complete admin summary."],
    ["Visitors", "Analyze my visitors and show important insights."],
    ["Messages", "Summarize latest messages and unread messages."],
    ["Security", "Run security audit and explain admin login attempts."],
    ["Charts", "Show me current traffic chart graph."],
  ];

  const startVoiceInput = () => {
    setVoiceOpen(true);
    setVoiceText("Listening... speak now");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceText("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ");

      setVoiceText(transcript || "Listening...");

      if (event.results[event.results.length - 1].isFinal && transcript) {
        setInput(transcript);
        setListening(false);
        setVoiceText("NS.ai is thinking...");
        askAI(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceText("Mic error: " + (event.error || "permission required"));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopVoiceAgent = () => {
    setVoiceOpen(false);
    setListening(false);
    setVoiceText("Tap the mic and speak with NS.ai");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section
      className={`fixed inset-0 z-[9998] overflow-hidden ${
        isDark ? "bg-[#111111] text-white" : "bg-[#f8fafc] text-slate-950"
      }`}
    >
      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(circle_at_50%_92%,rgba(236,72,153,0.22),transparent_18%),radial-gradient(circle_at_62%_92%,rgba(34,211,238,0.16),transparent_20%),radial-gradient(circle_at_72%_92%,rgba(132,204,22,0.18),transparent_20%)]"
            : "bg-[radial-gradient(circle_at_50%_92%,rgba(236,72,153,0.18),transparent_18%),radial-gradient(circle_at_62%_92%,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_72%_92%,rgba(132,204,22,0.13),transparent_20%)]"
        }`}
      />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActive("Overview")}
              className={`rounded-2xl px-4 py-3 font-black ${
                isDark ? "bg-white/10 hover:bg-white/15" : "bg-white shadow-sm hover:bg-slate-50"
              }`}
            >
              ☰ Menu
            </button>

            <div>
              <h1 className="text-xl font-black">NS.ai</h1>
              <p className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                Real AI Admin Agent • Developed by Naitik Soni
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button onClick={sendReportOnMail} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-100 text-emerald-700 shadow-sm"}`}>
              📩 Report on Mail
            </button>
            <button onClick={startNewChat} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              New Chat
            </button>
            <button onClick={() => setHistoryOpen(true)} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              History
            </button>
            <button onClick={toggleThemeMode} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              {isDark ? "Dark" : "Light"}
            </button>
            <button onClick={() => window.open("https://naitiksoni1417.netlify.app", "_blank")} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              Portfolio
            </button>
            <button onClick={() => window.open("https://mail.google.com/mail/u/0/#inbox", "_blank")} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              Mail
            </button>
            <button onClick={loadDashboard} className={`rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10" : "bg-white shadow-sm"}`}>
              Refresh
            </button>
            <button onClick={logout} className="rounded-full bg-red-500/90 px-5 py-3 text-sm font-black text-white shadow-lg">
              Logout
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col items-center px-5">
          {!chatStarted && (
          <div className="mt-16 text-center">
            <h2 className="text-4xl font-light tracking-tight md:text-5xl">
              {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, Naitik.infosec
            </h2>
            <p className={isDark ? "mt-3 text-slate-500" : "mt-3 text-slate-500"}>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          )}

          {!chatStarted && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {quick.map(([label, prompt]) => (
              <button
                key={label}
                onClick={() => askAI(prompt)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                    : "border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          )}

          <div className={`${chatStarted ? "mt-4" : "mt-8"} w-full max-w-4xl flex-1 overflow-y-auto pb-32 ns-ai-scroll`}>
            <div className="space-y-7">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-[1.7rem] px-6 py-5 text-[16px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-pink-200 text-slate-950"
                        : isDark
                        ? "border border-pink-300/80 bg-[#141414] text-slate-100 shadow-[0_0_22px_rgba(244,114,182,0.16)]"
                        : "border border-pink-300 bg-white text-slate-900 shadow-lg"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}

              {thinking && (
                <div className={`w-fit rounded-full px-5 py-3 text-sm font-black ${isDark ? "bg-white/10 text-pink-200" : "bg-white text-slate-700 shadow-sm"}`}>
                  NS.ai is thinking...
                </div>
              )}
            </div>
          </div>
        </main>

        <div className={`${chatStarted ? "bottom-7" : "top-[48%]"} absolute left-1/2 w-[92%] max-w-4xl -translate-x-1/2`}>
          <div
            className={`flex items-center gap-3 rounded-full px-3 py-3 shadow-[0_0_55px_rgba(236,72,153,0.24)] ${
              isDark ? "bg-[#18181b]/95 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_rgba(236,72,153,0.18)]" : "bg-white/95 shadow-xl"
            }`}
          >
             <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()}
              placeholder={typedPlaceholder || "Ask NS.ai..."}
              className={`flex-1 bg-transparent px-2 py-4 text-lg outline-none ${
                isDark ? "text-white placeholder:text-slate-400" : "text-slate-950 placeholder:text-slate-400"
              }`}
            />

            <button
              onClick={startVoiceInput}
              className={`hidden h-12 w-12 items-center justify-center rounded-full text-xl transition hover:scale-105 md:flex ${
                isDark ? "bg-white/10 text-slate-300 hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              title="Speak with NS.ai"
            >
              🎙
            </button>

            <button
              onClick={() => askAI()}
              disabled={thinking}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-2xl font-black text-white transition hover:scale-105 disabled:opacity-50"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-5 backdrop-blur-xl">
          <div className={`w-full max-w-3xl rounded-[2rem] border p-6 shadow-2xl ${
            isDark ? "border-white/10 bg-[#111]/95 text-white" : "border-slate-200 bg-white text-slate-950"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">NS.ai Chat History</h2>
                <p className="mt-1 text-sm opacity-60">Saved conversations stored in your browser.</p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="rounded-full bg-red-500 px-4 py-2 font-black text-white">
                Close
              </button>
            </div>

            <div className="mt-6 max-h-[450px] space-y-3 overflow-y-auto ns-ai-scroll">
              {chatHistory.length === 0 && (
                <p className="rounded-2xl bg-white/10 p-5 font-bold opacity-70">No saved chats yet.</p>
              )}

              {chatHistory.map((item) => (
                <div key={item.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                }`}>
                  <button onClick={() => openSavedChat(item)} className="flex-1 text-left">
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-xs opacity-60">{item.createdAt}</p>
                  </button>
                  <button onClick={() => deleteSavedChat(item.id)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {voiceOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-5 backdrop-blur-2xl">
          <div className={`relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border p-8 text-center shadow-[0_0_120px_rgba(34,211,238,0.35)] ${
            isDark ? "border-cyan-300/20 bg-[#060914]/90 text-white" : "border-cyan-200 bg-white/90 text-slate-950"
          }`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_50%_65%,rgba(168,85,247,0.25),transparent_35%)]" />

            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                NS.ai Voice Agent
              </p>

              <div className="mx-auto mt-8 flex h-56 w-56 items-center justify-center rounded-full border border-cyan-300/30 bg-black/30 shadow-[0_0_80px_rgba(34,211,238,0.35)]">
                <div className={`h-36 w-36 rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600 shadow-[0_0_70px_rgba(34,211,238,0.65)] ${
                  listening ? "animate-ping" : "animate-pulse"
                }`} />
                <div className="absolute text-5xl">✦</div>
              </div>

              <h2 className="mt-8 text-3xl font-black">Talk with NS.ai</h2>
              <p className="mx-auto mt-3 max-w-md text-sm font-semibold opacity-80">
                {voiceText}
              </p>

              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={startVoiceInput}
                  className="rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950 shadow-lg"
                >
                  Speak Again
                </button>

                <button
                  onClick={stopVoiceAgent}
                  className="rounded-full bg-red-500 px-6 py-3 font-black text-white shadow-lg"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function SecurityLogs({ analytics, reloadSecurity }) {
  const [selectedIp, setSelectedIp] = useState(null);

  useEffect(() => {
    reloadSecurity?.();
  }, []);

  const openIpPopup = (ip) => {
    const ipLogs = (analytics?.logs || []).filter((l) => l.ip === ip);
    const failed = ipLogs.filter((l) => l.action === "FAILED_LOGIN").length;
    const success = ipLogs.filter((l) => l.action !== "FAILED_LOGIN").length;
    const totalAttempts = ipLogs.reduce((sum, l) => sum + Number(l.attempts || 0), 0);
    const firstLog = ipLogs[ipLogs.length - 1] || {};
    const lastLog = ipLogs[0] || {};
    const riskScore = Math.min(100, failed * 22 + totalAttempts * 6 + ipLogs.length * 4);

    setSelectedIp({
      ip,
      logs: ipLogs,
      failed,
      success,
      totalAttempts,
      riskScore,
      firstLog,
      lastLog,
    });
  };

  const startVoiceInput = () => {
    setVoiceOpen(true);
    setVoiceText("Listening... speak now");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceText("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ");

      setVoiceText(transcript || "Listening...");

      if (event.results[event.results.length - 1].isFinal && transcript) {
        setInput(transcript);
        setListening(false);
        setVoiceText("NS.ai is thinking...");
        askAI(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceText("Mic error: " + (event.error || "permission required"));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopVoiceAgent = () => {
    setVoiceOpen(false);
    setListening(false);
    setVoiceText("Tap the mic and speak with NS.ai");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section className="mt-6 min-w-0 space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SecurityCard title="Failed Logins" value={analytics?.failedLoginCount || 0} note="Wrong admin password attempts" />
        <SecurityCard title="Blocked IPs" value={analytics?.blockedIps?.length || 0} note="Auto-blocked suspicious IPs" />
        <SecurityCard title="Peak Time" value={`${analytics?.peakTime?.hour ?? 0}:00`} note={`${analytics?.peakTime?.views || 0} views at peak hour`} />
        <SecurityCard title="Suspicious IPs" value={analytics?.suspiciousIps?.length || 0} note="Repeated failed login sources" />
      </div>

      <Card title="Security Logs" desc="Latest admin login events — click any IP for full intelligence report" icon={<FiShield />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="py-4">IP</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Key</th>
                <th>Location</th>
                <th>Device</th>
                <th>Attempts</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.logs || []).map((log, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() => openIpPopup(log.ip)}
                      className="rounded-xl bg-slate-950 px-3 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-600"
                    >
                      {log.ip}
                    </button>
                  </td>
                  <td>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      log.action === "FAILED_LOGIN"
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="font-semibold text-slate-500">{log.reason}</td>
                  <td className="font-black text-red-500">{log.attemptedKey || "***"}</td>
                  <td className="font-semibold text-slate-500">
                    {(log.city || "Unknown") + ", " + (log.country || "Unknown")}
                  </td>
                  <td className="font-semibold text-slate-500">
                    {(log.device || "Unknown") + " • " + (log.os || "Unknown") + " • " + (log.browser || "Unknown")}
                  </td>
                  <td className="font-black">{log.attempts || 0}</td>
                  <td className="text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedIp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020617]/90 p-4 backdrop-blur-2xl">
          <div className="relative max-h-[92vh] w-full max-w-7xl overflow-y-auto saas-modal-scroll rounded-[28px] border border-blue-400/20 bg-[#07111f] text-white shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_10%,rgba(37,99,235,0.28),transparent_35%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.16),transparent_28%)]" />

            <div className="relative z-10 flex items-start justify-between border-b border-white/10 p-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">SaaS Security Intelligence</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight text-white">IP Threat Command Center</h2>
                <p className="mt-3 flex items-center gap-2 text-lg font-bold text-slate-300">
                  {selectedIp.ip}
                  <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-xs text-blue-200">COPY</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 font-black text-red-300 hover:bg-red-500/20">
                  🛡 Block This IP
                </button>
                <button
                  onClick={() => setSelectedIp(null)}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="relative z-10 grid gap-5 p-7">
              <div className="grid gap-5 md:grid-cols-4">
                <CommandStat title="Threat Score" value={selectedIp.riskScore} note={selectedIp.riskScore > 70 ? "High Risk" : selectedIp.riskScore > 35 ? "Medium Risk" : "Low Risk"} danger />
                <CommandStat title="Total Attempts" value={selectedIp.totalAttempts || selectedIp.logs.length} note="All Time" />
                <CommandStat title="First Seen" value={selectedIp.firstLog.createdAt ? new Date(selectedIp.firstLog.createdAt).toLocaleDateString() : "Unknown"} note={selectedIp.firstLog.createdAt ? new Date(selectedIp.firstLog.createdAt).toLocaleTimeString() : ""} />
                <CommandStat title="Last Seen" value={selectedIp.lastLog.createdAt ? new Date(selectedIp.lastLog.createdAt).toLocaleDateString() : "Unknown"} note={selectedIp.lastLog.createdAt ? new Date(selectedIp.lastLog.createdAt).toLocaleTimeString() : ""} />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <CommandPanel title="🌍 Location Intelligence">
                  <CommandRow label="Country" value={selectedIp.lastLog.country || "Unknown"} />
                  <CommandRow label="City" value={selectedIp.lastLog.city || "Unknown"} />
                  <CommandRow label="ISP" value={selectedIp.lastLog.isp || "Unknown"} />
                  <CommandRow label="ASN" value={selectedIp.lastLog.asn || "Unknown"} />
                </CommandPanel>

                <CommandPanel title="🖥 Device Fingerprint">
                  <CommandRow label="Device" value={selectedIp.lastLog.device || "Unknown"} />
                  <CommandRow label="OS" value={selectedIp.lastLog.os || "Unknown"} />
                  <CommandRow label="Browser" value={selectedIp.lastLog.browser || "Unknown"} />
                  <CommandRow label="User Agent" value={selectedIp.lastLog.userAgent || "Unknown"} />
                </CommandPanel>

                <CommandPanel title="⏱ Activity Window">
                  <CommandRow label="First Attempt" value={selectedIp.firstLog.createdAt ? new Date(selectedIp.firstLog.createdAt).toLocaleString() : "Unknown"} />
                  <CommandRow label="Last Attempt" value={selectedIp.lastLog.createdAt ? new Date(selectedIp.lastLog.createdAt).toLocaleString() : "Unknown"} />
                  <CommandRow label="Success" value={selectedIp.success || 0} />
                  <CommandRow label="Failed" value={selectedIp.failed || 0} />
                </CommandPanel>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-6">
                <h3 className="mb-6 text-xl font-black text-white">⚡ Login Activity Timeline</h3>

                <div className="space-y-4">
                  {selectedIp.logs.map((log, i) => (
                    <div key={i} className="grid gap-3 rounded-2xl border border-white/10 bg-[#0b1728]/80 p-4 text-sm md:grid-cols-5">
                      <div>
                        <span className={`font-black ${log.action === "FAILED_LOGIN" ? "text-red-400" : "text-emerald-400"}`}>
                          {log.action}
                        </span>
                        <p className="mt-1 text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown"}</p>
                      </div>
                      <p className="text-slate-300">Reason: {log.reason || "Recorded"}</p>
                      <p className="text-slate-300">Attempts: {log.attempts || 0}</p>
                      <p className="text-slate-300">Key: {log.attemptedKey || "***"}</p>
                      <p className="font-bold text-slate-400">{log.city || "Unknown"}, {log.country || "Unknown"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function CommandStat({ title, value, note, danger }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.055] p-6 shadow-xl">
      <p className="text-sm font-black text-slate-200">{title}</p>
      <h4 className={`mt-4 text-4xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</h4>
      <p className={`mt-2 text-sm font-bold ${danger ? "text-red-400" : "text-slate-400"}`}>{note}</p>
    </div>
  );
}

function CommandPanel({ title, children }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-6 shadow-xl">
      <h3 className="mb-5 text-lg font-black text-white">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function CommandRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-white/10 pb-3 last:border-none">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="col-span-2 break-words font-bold text-slate-100">{value}</p>
    </div>
  );
}


function SecurityCard({ title, value, note }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <h2 className="mt-3 text-4xl font-black text-slate-950">{value}</h2>
      <p className="mt-2 text-xs font-semibold text-slate-400">{note}</p>
    </div>
  );
}


function Sidebar({ menu, active, setActive, sidebarOpen, setSidebarOpen , unreadMessages}) {
  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-dvh w-[18rem] max-w-[86vw] flex-col border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 lg:w-72 lg:p-6 lg:shadow-none lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FiGrid />
          </div>
          <div>
            <h2 className="text-xl font-black">Naitik Admin</h2>
            <p className="text-xs font-semibold text-slate-500">Portfolio CRM</p>
          </div>
        </div>

        <button className="text-xl lg:hidden" onClick={() => setSidebarOpen(false)}>
          <FiX />
        </button>
      </div>

      <nav className="mt-8 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-4">
        {menu.map(([name, icon]) => (
          <button
            key={name}
            onClick={() => {
              setActive(name);
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition lg:px-4 ${
              active === name
                ? "bg-slate-950 text-white shadow-lg"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span>{name}</span>

            {name === "Messages" && Number(unreadMessages) > 0 && (
              <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-black text-white shadow-lg">
                {Number(unreadMessages) > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-3 shrink-0 rounded-3xl bg-slate-100 p-4">
        <p className="text-sm font-black">System Online</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Backend + MongoDB connected</p>
        <div className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
        </div>
      </div>
    </aside>
  );
}

function Card({ title, desc, icon, children, className = "" }) {
  return (
    <div className={`rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm font-semibold text-slate-500">{desc}</p>
        </div>
        <div className="text-2xl text-slate-400">{icon}</div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Ranking({ data = [] }) {
  const max = Math.max(...data.map((i) => i.count || i.value || 0), 1);

  return (
    <div className="space-y-4">
      {data.length === 0 && <p className="text-sm font-semibold text-slate-400">No data yet</p>}
      {data.map((item, index) => {
        const value = item.count || item.value || 0;
        const label = item._id || item.name || "Unknown";
        return (
          <div key={`${label}-${index}`}>
            <div className="flex justify-between text-sm">
              <span className="font-black text-slate-700">{label}</span>
              <span className="font-black text-slate-950">{value}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-slate-950"
                style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PieChartBox({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={95}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarChartBox({ data, dataKey, height = "h-72" }) {
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={dataKey} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Bar dataKey="views" fill="#020617" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VisitorsTable({ visitors, query, setQuery, exportVisitorsCSV, setSelectedVisitor , adminIp}) {
  const adminIpLocal = localStorage.getItem("admin_ip") || "";
  const isAdminVisitor = (v) => String(v?.ip || "").trim() === String(adminIpLocal).trim();

  const startVoiceInput = () => {
    setVoiceOpen(true);
    setVoiceText("Listening... speak now");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceText("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ");

      setVoiceText(transcript || "Listening...");

      if (event.results[event.results.length - 1].isFinal && transcript) {
        setInput(transcript);
        setListening(false);
        setVoiceText("NS.ai is thinking...");
        askAI(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceText("Mic error: " + (event.error || "permission required"));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopVoiceAgent = () => {
    setVoiceOpen(false);
    setListening(false);
    setVoiceText("Tap the mic and speak with NS.ai");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black">Recent Visitors</h2>
          <p className="text-sm font-semibold text-slate-500">Latest captured portfolio activity</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={exportVisitorsCSV}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
          >
            <FiDownload /> Export CSV
          </button>

          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search visitor..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-slate-950 md:w-72"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead>
            <tr className="border-b border-slate-100 text-sm text-slate-400">
              <th className="py-4">Visitor</th>
              <th>Location</th>
              <th>ISP</th>
              <th>Device</th>
              <th>Page</th>
              <th>Visits</th>
              <th>Last Seen</th>
            </tr>
          </thead>

          <tbody>
            {visitors.map((v) => (
              <tr key={v._id} className="border-b border-slate-100 text-sm">
                <td className="py-4">
                  <button
                    type="button"
                    onClick={() => setSelectedVisitor(v)}
                    className="font-black text-slate-950 hover:text-blue-600 hover:underline"
                  >
                    {v.ip}
                  </button>
                  <p className={`mt-1 text-xs font-black ${v.isReturning ? "text-violet-600" : "text-emerald-600"}`}>
                    {v.isAdmin ? "Admin / Me" : v.isReturning ? "Returning" : "New"}
                  </p>
                </td>
                <td>
                  <p className="font-black">{v.city || "Unknown"}, {v.country || "Unknown"}</p>
                  <p className="text-xs font-semibold text-slate-400">{v.region || ""}</p>
                </td>
                <td className="max-w-[220px] truncate text-slate-500">{v.isp || "Unknown"}</td>
                <td>{v.device || "Desktop"} • {v.os} • {v.browser}</td>
                <td className="font-black">{v.page}</td>
                <td>{v.visits || 1}</td>
                <td className="text-slate-500">{v.createdAt ? new Date(v.createdAt).toLocaleString() : "Unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Messages({ messages, exportMessagesCSV, updateMessageStatus, deleteMessage, token, loadDashboard }) {
  const [replyOpen, setReplyOpen] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const sendReply = async () => {
    if (!replyOpen || !replyText.trim()) return alert("Please write reply message");
    setReplyLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/messages/${replyOpen._id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reply: replyText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reply failed");

      setReplyOpen(null);
      setReplyText("");
      await loadDashboard?.();
      alert("Reply sent successfully ✅");
    } catch (err) {
      alert(err.message || "Reply failed");
    } finally {
      setReplyLoading(false);
    }
  };

  const startVoiceInput = () => {
    setVoiceOpen(true);
    setVoiceText("Listening... speak now");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceText("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ");

      setVoiceText(transcript || "Listening...");

      if (event.results[event.results.length - 1].isFinal && transcript) {
        setInput(transcript);
        setListening(false);
        setVoiceText("NS.ai is thinking...");
        askAI(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceText("Mic error: " + (event.error || "permission required"));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopVoiceAgent = () => {
    setVoiceOpen(false);
    setListening(false);
    setVoiceText("Tap the mic and speak with NS.ai");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-2">
      {messages.length === 0 && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          No messages yet
        </div>
      )}

      {messages.map((m) => (
        <div key={m._id} className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black">{m.name}</h3>
              <p className="text-sm font-bold text-slate-500">{m.email}</p>
            </div>

            <span className={`rounded-full px-3 py-1 text-xs font-black ${
              m.status === "Unread" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {m.status}
            </span>
          </div>

          <p className="mt-5 text-[17px] font-semibold leading-relaxed text-slate-800">
            {m.message}
          </p>

          <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4 md:grid-cols-2">
            <MsgInfo label="IP Address" value={m.ip || "Not captured"} />
            <MsgInfo label="City" value={m.city || "Unknown"} />
            <MsgInfo label="Country" value={m.country || "Unknown"} />
            <MsgInfo label="Device" value={m.device || "Desktop"} />
            <MsgInfo label="OS" value={m.os || "Unknown"} />
            <MsgInfo label="Browser" value={m.browser || "Unknown"} />
            <MsgInfo label="ISP" value={m.isp || "Unknown"} />
            <MsgInfo label="Time" value={m.createdAt ? new Date(m.createdAt).toLocaleString() : "Unknown"} />
          </div>

          <p className="mt-4 text-xs font-bold text-slate-400">
            Page: {m.page || "/contact"}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => updateMessageStatus(m._id, m.status === "Unread" ? "Read" : "Unread")}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
            >
              Mark {m.status === "Unread" ? "Read" : "Unread"}
            </button>

            <button
              onClick={() => {
                setReplyOpen(m);
                setReplyText(`Hi ${m.name || "there"},\n\nThank you for contacting me. `);
              }}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              Reply
            </button>

            <button
              onClick={() => deleteMessage(m._id)}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {replyOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2.5rem] border border-white/40 bg-white p-7 shadow-[0_35px_120px_rgba(15,23,42,.40)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.35em] text-cyan-600">ADMIN MESSAGE REPLY</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">Reply to {replyOpen.name}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{replyOpen.email}</p>
              </div>

              <button
                onClick={() => setReplyOpen(null)}
                className="rounded-2xl bg-slate-950 px-4 py-3 font-black text-white hover:bg-red-500"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Original Message</p>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-700">{replyOpen.message}</p>
            </div>

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={8}
              className="mt-5 w-full rounded-3xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-800 outline-none focus:border-slate-950"
              placeholder="Write your professional reply..."
            />

            <button
              onClick={sendReply}
              disabled={replyLoading}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-4 font-black text-white shadow-lg disabled:opacity-60"
            >
              {replyLoading ? "Sending Reply..." : "Send Reply"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MsgInfo({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function downloadCSV(rows, filename) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}


async function getPublicIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "";
  } catch {
    return "";
  }
}



function CommandCenter({
  command,
  updateCommand,
  clearVisitors,
  clearMessages,
  exportVisitorsCSV,
  exportMessagesCSV,
  loadDashboard,
}) {
  const exportAdminLogs = () => {
    const logs = command?.adminLogs || [];
    const csv = [
      "action,ip,createdAt",
      ...logs.map((l) => `"${l.action || ""}","${l.ip || ""}","${l.createdAt || ""}"`)
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const startVoiceInput = () => {
    setVoiceOpen(true);
    setVoiceText("Listening... speak now");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceText("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ");

      setVoiceText(transcript || "Listening...");

      if (event.results[event.results.length - 1].isFinal && transcript) {
        setInput(transcript);
        setListening(false);
        setVoiceText("NS.ai is thinking...");
        askAI(transcript, true);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceText("Mic error: " + (event.error || "permission required"));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopVoiceAgent = () => {
    setVoiceOpen(false);
    setListening(false);
    setVoiceText("Tap the mic and speak with NS.ai");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section className="mt-6 min-w-0 space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-slate-400">CYBER OPERATIONS</p>
        <h2 className="mt-2 text-4xl font-black text-slate-950">Command Center</h2>
        <p className="mt-2 font-semibold text-slate-500">
          Control maintenance, live tracking, exports and danger actions.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <CommandCard title="System Controls">
          <button onClick={() => updateCommand({ maintenanceMode: !command?.maintenanceMode, action: "Maintenance mode toggled" })} className="w-full rounded-2xl bg-slate-100 px-5 py-4 text-left font-black">
            Maintenance Mode: {command?.maintenanceMode ? "ON" : "OFF"}
          </button>

          <button onClick={() => updateCommand({ liveTracking: command?.liveTracking === false, action: "Live tracking toggled" })} className="mt-3 w-full rounded-2xl bg-slate-100 px-5 py-4 text-left font-black">
            Live Tracking: {command?.liveTracking !== false ? "ON" : "OFF"}
          </button>

          <button onClick={loadDashboard} className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-4 text-left font-black text-white">
            Force Refresh Dashboard
          </button>
        </CommandCard>

        <CommandCard title="Export Center">
          <button onClick={exportVisitorsCSV} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-left font-black text-white">
            Export Visitors CSV
          </button>
          <button onClick={exportMessagesCSV} className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-4 text-left font-black text-white">
            Export Messages CSV
          </button>
          <button onClick={exportAdminLogs} className="mt-3 w-full rounded-2xl bg-slate-100 px-5 py-4 text-left font-black text-slate-700">
            Export Admin Logs
          </button>
        </CommandCard>

        <CommandCard title="Quick Controls">
          <button onClick={() => window.open("https://naitiksoni1417.netlify.app", "_blank")} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-left font-black text-white">
            Open Portfolio
          </button>
          <button onClick={() => window.open("https://mail.google.com/mail/u/0/#inbox", "_blank")} className="mt-3 w-full rounded-2xl bg-slate-100 px-5 py-4 text-left font-black text-slate-700">
            Open Mail
          </button>
        </CommandCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CommandCard title="Danger Zone">
          <button onClick={clearVisitors} className="w-full rounded-2xl bg-red-50 px-5 py-4 text-left font-black text-red-600">
            Clear All Visitors
          </button>
          <button onClick={clearMessages} className="mt-3 w-full rounded-2xl bg-red-50 px-5 py-4 text-left font-black text-red-600">
            Delete All Messages
          </button>
        </CommandCard>

        <CommandCard title="Admin Activity Logs">
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {(command?.adminLogs || []).length === 0 && (
              <p className="text-sm font-semibold text-slate-400">No admin logs yet</p>
            )}

            {(command?.adminLogs || []).map((log, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-black text-slate-800">{log.action}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  IP: {log.ip || "Unknown"} • {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                </p>
              </div>
            ))}
          </div>
        </CommandCard>
      </div>
    </section>
  );
}

function CommandCard({ title, children }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-5 text-xl font-black text-slate-950">{title}</h3>
      {children}
    </div>
  );
}
