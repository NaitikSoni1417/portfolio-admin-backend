import React, { useEffect, useMemo, useState } from "react";
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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
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

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setData(null);
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
    ["Command Center", <FiShield />],
    ["Visitors", <FiUsers />],
    ["Messages", <FiInbox />],
    ["Analytics", <FiTrendingUp />],
    ["Security Logs", <FiShield />],
    ["Devices", <FiSmartphone />],
    ["Earth View", <FiGlobe />],
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
    <div className="min-h-screen bg-[#f6f8ff] text-slate-950">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {!menuHidden && (
      <Sidebar
        menu={menu}
        active={active}
        setActive={setActive}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      )}

      <main className={`p-4 md:p-8 ${menuHidden ? "" : "lg:ml-72"}`}>
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

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-2">
            <FiClock /> Last sync: {lastSync ? lastSync.toLocaleString() : "Loading..."}
          </span>
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">
            API: {API_URL.replace("https://", "")}
          </span>
        </div>

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

        {active === "Command Center" && (
          <CommandCenter
            command={command}
            updateCommand={async (payload) => {
              try {
                await fetch(`${API_URL}/api/admin/command-center`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                });
                loadDashboard();
              } catch (err) {
                console.error("Command update failed", err);
              }
            }}
            clearVisitors={clearVisitors}
            clearMessages={clearMessages}
            exportVisitorsCSV={exportVisitorsCSV}
            exportMessagesCSV={exportMessagesCSV}
            loadDashboard={loadDashboard}
          />
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
          <SecurityLogs analytics={advancedAnalytics} />
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


function SecurityLogs({ analytics }) {
  return (
    <section className="mt-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SecurityCard title="Failed Logins" value={analytics?.failedLoginCount || 0} note="Wrong admin password attempts" />
        <SecurityCard title="Blocked IPs" value={analytics?.blockedIps?.length || 0} note="Auto-blocked suspicious IPs" />
        <SecurityCard title="Peak Time" value={`${analytics?.peakTime?.hour ?? 0}:00`} note={`${analytics?.peakTime?.views || 0} views at peak hour`} />
        <SecurityCard title="Suspicious IPs" value={analytics?.suspiciousIps?.length || 0} note="Repeated failed login sources" />
      </div>

      <Card title="Security Logs" desc="Latest admin login events" icon={<FiShield />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="py-4">IP</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Attempts</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.logs || []).map((log, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-4 font-black">{log.ip}</td>
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
                  <td className="font-black">{log.attempts || 0}</td>
                  <td className="text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
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


function Sidebar({ menu, active, setActive, sidebarOpen, setSidebarOpen }) {
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
            {name}
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

function VisitorsTable({ visitors, query, setQuery, exportVisitorsCSV, setSelectedVisitor }) {
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
