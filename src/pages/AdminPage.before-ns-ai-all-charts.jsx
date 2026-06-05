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
    } catch (err) {
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

    alert("Password changed successfully. Security email sent ✅");
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
    ["Analytics", <FiTrendingUp />],
    ["Security Logs", <FiShield />],
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


  return (
    <div id="admin-dashboard-root" data-theme={theme} className={`min-h-screen transition-colors duration-300 ${theme === "dark" ? "bg-[#020617] text-white" : "bg-[#f6f8ff] text-slate-950"}`}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {!menuHidden && (
      <Sidebar
        menu={menu}
        active={active}
        setActive={setActive}
        unreadMessages={data?.unreadMessages || 0}
        unreadMessages={data?.unreadMessages || 0}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      )}

      <main className={`p-4 md:p-8 ${menuHidden ? "" : "lg:ml-72"}`}>
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
              <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                Portfolio Dashboard
              </h1>
              <p className="mt-2 text-slate-500">
                Real-time analytics, visitors, Earth view and contact CRM.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
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
        {active === "Settings" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Change Admin Password" desc="Secure password update with email alert" icon={<FiShield />}>
              <div className="grid gap-4">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none focus:border-slate-950"
                />

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none focus:border-slate-950"
                />

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold outline-none focus:border-slate-950"
                />

                <button
                  onClick={changeAdminPasswordSecure}
                  className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg"
                >
                  Update Password
                </button>
              </div>
            </Card>

            <Card title="Security Alert" desc="Professional email notification" icon={<FiMail />}>
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="font-black text-slate-800">Email alert will be sent to:</p>
                <p className="mt-1 font-bold text-slate-500">naitik.infosec@gmail.com</p>

                <div className="mt-5 space-y-2 text-sm font-semibold text-slate-600">
                  <p>✅ Password change time</p>
                  <p>✅ Browser and device info</p>
                  <p>✅ Admin panel page URL</p>
                  <p>✅ Security warning message</p>
                  <p>❌ Password will not be sent in email for safety</p>
                </div>
              </div>
            </Card>
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
          />
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
            <p className="text-xs font-black tracking-[0.25em] text-cyan-600">
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






function NSAIChat({ data, security, token, loadDashboard, loadAdvancedAnalytics, theme }) {
  const isDark = theme === "dark";
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi Naitik, I am NS.ai — your real AI admin agent. Ask me about visitors, traffic, messages, security logs, suspicious IPs, growth and website health."
    }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard?.();
      loadAdvancedAnalytics?.();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prompts = [
    "What is my website growth today?",
    "Show me current traffic chart graph.",
    "Give me today's traffic performance summary.",
    "Did anyone try to access my admin panel today?",
    "Show me suspicious IP activity.",
    "Generate a security risk score for today.",
    "Explain my admin security logs in simple words.",
    "What was the last message I received?",
    "Summarize unread messages.",
    "Find high-value leads from messages.",
    "Which visitor looks like a recruiter?",
    "Which visitor looks like a potential client?",
    "Which country and city is most active?",
    "Analyze visitor device and browser trends.",
    "Give me a CEO-style daily report.",
    "Tell me the most important thing right now.",
    "Detect abnormal visitor behavior.",
    "What should I improve on my portfolio?",
    "Is my website working properly?",
    "Show top visited pages.",
    "Show visitor quality score.",
    "Give me a 5-point action plan for today.",
    "Compare today's traffic with previous days.",
    "Find returning visitors and explain their intent.",
    "Create a professional growth summary."
  ];

  const askAI = async (q = input) => {
    if (!q.trim()) return;

    const wantsChart = /chart|graph|traffic chart|traffic graph|current traffic|trend/i.test(q);

    setMessages((prev) => [...prev, { role: "user", text: q }]);

    if (wantsChart) {
      const chartData = (data?.dailyViews || []).map((d) => ({
        label: d._id,
        views: d.views || 0,
      }));

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Here is your current traffic chart based on the latest dashboard data.",
          chart: {
            title: "Current Traffic Trend",
            subtitle: "Views from recent dashboard analytics",
            data: chartData,
          }
        }
      ]);
    }
    setInput("");
    setThinking(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/ns-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q, dashboard: data, security }),
      });

      const result = await res.json();
      setMessages((prev) => [...prev, { role: "ai", text: result.answer || result.error || "NS.ai could not answer right now." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "NS.ai connection failed. Please check backend deployment." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className={`relative -mt-4 min-h-[calc(100vh-40px)] overflow-hidden rounded-[34px] p-5 shadow-2xl ${
      isDark
        ? "bg-[#050816] text-white"
        : "bg-white/75 text-slate-950 ring-1 ring-slate-200 backdrop-blur-2xl"
    }`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,0.24),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,0.16),transparent_34%)]" />

      <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className={`flex min-h-[760px] flex-col overflow-hidden rounded-[30px] backdrop-blur-2xl ${
            isDark
              ? "border border-white/10 bg-white/[0.055]"
              : "border border-white/70 bg-white/70 shadow-xl"
          }`}>
          <div className={`border-b p-7 ${isDark ? "border-white/10" : "border-slate-200/70"}`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 text-4xl shadow-[0_0_45px_rgba(34,211,238,0.35)]">
                  ✦
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                    REAL AI ADMIN AGENT
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight">
                    NS.ai Intelligence Core
                  </h2>
                  <p className={`mt-2 max-w-2xl text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}` }>
                    Real-time AI assistant for visitors, messages, traffic, security logs and growth.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <NSPill text="AI ONLINE" />
                <NSPill text="5s LIVE CONTEXT" />
                <NSPill text={`${data?.todayViews || 0} VIEWS TODAY`} />
                <NSPill text={`${security?.failedLoginCount || 0} SECURITY EVENTS`} />
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-7 ns-ai-scroll">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600 text-xl">
                    ✦
                  </div>
                )}

                <div className={`max-w-[760px] rounded-[24px] px-5 py-4 text-[15px] font-semibold leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-cyan-300 via-blue-400 to-violet-500 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.25)]"
                    : isDark ? "border border-white/10 bg-[#101827]/85 text-slate-100" : "border border-slate-200 bg-white/80 text-slate-800 shadow-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {m.chart && (
                    <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-black/20 p-4">
                      <div className="mb-4">
                        <h4 className="text-lg font-black">{m.chart.title}</h4>
                        <p className="text-xs font-semibold text-slate-400">{m.chart.subtitle}</p>
                      </div>

                      <div className="flex h-44 items-end gap-2">
                        {(m.chart.data || []).map((item, idx) => {
                          const max = Math.max(...(m.chart.data || []).map((x) => x.views || 0), 1);
                          const height = Math.max(8, ((item.views || 0) / max) * 150);

                          return (
                            <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                              <div
                                className="w-full rounded-t-xl bg-gradient-to-t from-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                                style={{ height: `${height}px` }}
                              />
                              <span className="text-[10px] font-black text-slate-400">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600">✦</div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 text-sm font-black text-cyan-300">
                  NS.ai is analyzing live admin data...
                </div>
              </div>
            )}
          </div>

          <div className={`border-t p-5 backdrop-blur-2xl ${
            isDark ? "border-white/10 bg-[#07111f]/95" : "border-slate-200 bg-white/70"
          }`}>
            <div className={`relative flex items-center gap-3 rounded-[999px] border p-2 ${
              isDark
                ? "border-cyan-300/50 bg-white/[0.07] shadow-[0_0_35px_rgba(34,211,238,0.22),inset_0_0_30px_rgba(255,255,255,0.04)]"
                : "border-cyan-300/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]"
            }`}>
              <div className="pointer-events-none absolute inset-0 rounded-[999px] bg-gradient-to-r from-cyan-400/10 via-transparent to-violet-500/10" />

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Ask NS.ai anything about your admin panel..."
                className={`relative z-10 flex-1 rounded-full bg-transparent px-6 py-5 text-[15px] font-bold outline-none placeholder:text-slate-400 ${
                  isDark ? "text-white" : "text-slate-950"
                }`}
              />

              <button
                onClick={() => askAI()}
                disabled={thinking}
                className="relative z-10 rounded-full bg-gradient-to-br from-cyan-300 via-blue-400 to-violet-500 px-8 py-5 font-black text-white shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:scale-105 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className={`rounded-[28px] p-5 backdrop-blur-2xl ${
            isDark ? "border border-white/10 bg-white/[0.06]" : "border border-white/70 bg-white/70 shadow-xl"
          }`}>
            <h3 className="text-xl font-black">Premium Questions</h3>
            <div className="mt-5 space-y-3">
              {prompts.map((q) => (
                <button
                  key={q}
                  onClick={() => askAI(q)}
                  className={`w-full rounded-2xl border p-4 text-left text-sm font-bold transition hover:border-cyan-300/60 hover:bg-cyan-300/10 ${
                    isDark ? "border-white/10 bg-[#111827]/75 text-slate-100" : "border-slate-200 bg-white/80 text-slate-800"
                  }`}
                >
                  ✦ {q}
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-[28px] p-5 backdrop-blur-2xl ${
            isDark ? "border border-white/10 bg-white/[0.06]" : "border border-white/70 bg-white/70 shadow-xl"
          }`}>
            <h3 className="text-xl font-black">Quick Actions</h3>
            <div className="mt-5 grid gap-3">
              <button onClick={() => askAI("Generate a professional daily report.")} className={`rounded-2xl p-4 text-left font-black hover:bg-cyan-300/10 ${
                  isDark ? "bg-white/[0.07] text-white" : "bg-white/80 text-slate-800 shadow-sm"
                }`}>📄 Generate Report</button>
              <button onClick={() => askAI("Find recruiters and hot leads from today's data.")} className={`rounded-2xl p-4 text-left font-black hover:bg-cyan-300/10 ${
                  isDark ? "bg-white/[0.07] text-white" : "bg-white/80 text-slate-800 shadow-sm"
                }`}>🎯 Find Hot Leads</button>
              <button onClick={() => askAI("Run a full security audit of admin panel logs.")} className={`rounded-2xl p-4 text-left font-black hover:bg-cyan-300/10 ${
                  isDark ? "bg-white/[0.07] text-white" : "bg-white/80 text-slate-800 shadow-sm"
                }`}>🛡 Security Audit</button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function NSPill({ text }) {
  return (
    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
      ● {text}
    </span>
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

  return (
    <section className="mt-6 space-y-6">
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
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">SaaS Security Intelligence</p>
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
      className={`fixed left-0 top-0 z-50 h-full w-72 border-r border-slate-200 bg-white p-6 transition-transform duration-300 lg:translate-x-0 ${
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

      <nav className="mt-10 space-y-2">
        {menu.map(([name, icon]) => (
          <button
            key={name}
            onClick={() => {
              setActive(name);
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
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

      <div className="absolute bottom-6 left-6 right-6 rounded-3xl bg-slate-100 p-4">
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

function Messages({ messages, exportMessagesCSV, updateMessageStatus, deleteMessage }) {
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
              onClick={() => deleteMessage(m._id)}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
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

  return (
    <section className="mt-6 space-y-6">
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
