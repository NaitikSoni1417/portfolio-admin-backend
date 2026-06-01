const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://portfolio-admin-backend-vsud.onrender.com";

function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  return "Unknown";
}

function getOS() {
  const ua = navigator.userAgent;
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown";
}

function getDevice() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "mobile"
    : "Desktop";
}

async function getGeo() {
  try {
    const r = await fetch("https://ipapi.co/json/");
    const d = await r.json();
    if (d.ip) {
      return {
        ip: d.ip,
        city: d.city,
        region: d.region,
        country: d.country_name,
        isp: d.org,
        lat: d.latitude,
        lng: d.longitude,
      };
    }
  } catch {}

  try {
    const r = await fetch("https://ipwho.is/");
    const d = await r.json();
    return {
      ip: d.ip,
      city: d.city,
      region: d.region,
      country: d.country,
      isp: d.connection?.isp,
      lat: d.latitude,
      lng: d.longitude,
    };
  } catch {}

  return {};
}

export async function trackVisitor() {
  try {
    const geo = await getGeo();

    await fetch(`${API_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname || "/",
        ip: geo.ip || "",
        city: geo.city || "Unknown",
        region: geo.region || "Unknown",
        country: geo.country || "Unknown",
        isp: geo.isp || "Unknown",
        lat: geo.lat || null,
        lng: geo.lng || null,
        browser: getBrowser(),
        os: getOS(),
        device: getDevice(),
      }),
    });
  } catch (err) {
    console.error("Tracking Error:", err);
  }
}
