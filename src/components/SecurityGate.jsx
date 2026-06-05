import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

export default function SecurityGate({ children }) {
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        // NS.ai SOC protection active for portfolio + admin routes

        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();

        const res = await fetch(`${API_URL}/api/security/check?ip=${ipData.ip}`);
        const data = await res.json();

        if (res.status === 403 || data.blocked) {
          setBlocked(data);
        }
      } catch {}
    };

    run();
  }, []);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#020617] p-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.22),transparent_35%)]" />

        <div className="relative w-full max-w-xl rounded-[2.5rem] border border-red-400/30 bg-white/10 p-8 text-center shadow-[0_0_120px_rgba(239,68,68,.25)] backdrop-blur-2xl">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20 text-5xl">
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
            <p>IP: {blocked.ip || "Unknown"}</p>
            <p className="mt-2">Reason: {blocked.reason || "Blocked by NS.ai SOC"}</p>
            <p className="mt-2">
              Expires: {blocked.expiresAt ? new Date(blocked.expiresAt).toLocaleString() : "Permanent"}
            </p>
          </div>

          <p className="mt-6 text-sm font-black text-cyan-300">
            Contact: naitik.infosec@gmail.com
          </p>
        </div>
      </div>
    );
  }

  return children;
}
