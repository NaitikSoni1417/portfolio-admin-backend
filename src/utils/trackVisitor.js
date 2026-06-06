const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

const getSessionId = () => {
  let id = localStorage.getItem("ns_session_id");
  if (!id) {
    id = `ns_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("ns_session_id", id);
  }
  return id;
};

const getVisitedPages = () => {
  const pages = JSON.parse(sessionStorage.getItem("ns_pages") || "[]");
  const path = window.location.pathname || "/";
  if (!pages.includes(path)) pages.push(path);
  sessionStorage.setItem("ns_pages", JSON.stringify(pages));
  return pages;
};

export const trackVisitor = async (page = window.location.pathname) => {
  try {
    const startedAt = Number(sessionStorage.getItem("ns_started_at") || Date.now());
    sessionStorage.setItem("ns_started_at", String(startedAt));

    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipRes.json();

    const payload = {
      page,
      publicIp: ipData.ip,
      sessionId: getSessionId(),
      sessionDuration: Math.floor((Date.now() - startedAt) / 1000),
      pagesViewed: getVisitedPages(),
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || "Direct",
    };

    await fetch(`${API_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.log("Tracking failed:", err);
  }
};

export default trackVisitor;
