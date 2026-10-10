/**
 * Turns raw referrer URLs into the human sources an admin actually cares
 * about: "Google Search", "Instagram", "Local development", "Direct"…
 *
 * Pure and dependency-free — `new URL` only, no network, no guessing. A value
 * that cannot be parsed is kept verbatim rather than reshaped into something
 * it is not.
 */

const UNKNOWN_KEYS = new Set(["", "-", "none", "null", "undefined", "unknown", "(direct)", "direct"]);

/** Hostnames that mean the hit came from a local dev server, not the internet. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/** `{ key, label, kind, host }` — `kind` drives the icon on the frontend. */
function source(key, label, kind, host = "") {
  return { key, label, kind, host };
}

function hostOf(value) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return {
      host: url.hostname.toLowerCase().replace(/^www\./, ""),
      path: url.pathname.toLowerCase(),
      query: url.search.toLowerCase(),
      ok: true,
    };
  } catch {
    return { host: "", path: "", query: "", ok: false };
  }
}

const SOCIAL = [
  [/^instagram\.com$/, "Instagram", "instagram"],
  [/^(www\.)?linkedin\.com$/, "LinkedIn", "linkedin"],
  [/^(twitter|x)\.com$/, "X (Twitter)", "x"],
  [/^facebook\.com$/, "Facebook", "facebook"],
  [/^fb\.me$/, "Facebook", "facebook"],
  [/^youtube\.com$/, "YouTube", "youtube"],
  [/^youtu\.be$/, "YouTube", "youtube"],
  [/^reddit\.com$/, "Reddit", "reddit"],
  [/^redd\.it$/, "Reddit", "reddit"],
  [/^tiktok\.com$/, "TikTok", "tiktok"],
  [/^pinterest\.[a-z.]+$/, "Pinterest", "pinterest"],
  [/^quora\.com$/, "Quora", "quora"],
  [/^discord\.(com|gg)$/, "Discord", "discord"],
  [/^(t\.me|telegram\.me|telegram\.org)$/, "Telegram", "telegram"],
  [/^medium\.com$/, "Medium", "medium"],
  [/^stackoverflow\.com$/, "Stack Overflow", "github"],
  [/^github\.com$/, "GitHub", "github"],
];

const SEARCH = [
  // Subdomains (images.google.com, www.google.co.in) count as Google too, but
  // googleusercontent.com deliberately does not — it is a media host.
  [/^(?:[a-z0-9-]+\.)*google\.[a-z.]{2,}$/, "Google", "google"],
  [/^(?:[a-z0-9-]+\.)*bing\.com$/, "Bing", "bing"],
  [/^(?:[a-z0-9-]+\.)*duckduckgo\.com$/, "DuckDuckGo", "duckduckgo"],
  [/^(?:[a-z0-9-]+\.)*yahoo\.[a-z.]{2,}$/, "Yahoo", "yahoo"],
  [/^(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,}$/, "Yandex", "yandex"],
  [/^(?:[a-z0-9-]+\.)*ecosia\.org$/, "Ecosia", "ecosia"],
  [/^(?:[a-z0-9-]+\.)*search\.brave\.com$/, "Brave Search", "brave"],
  [/^(?:[a-z0-9-]+\.)*baidu\.com$/, "Baidu", "baidu"],
];

const SHOPPING = [
  [/^amazon\.[a-z.]{2,}$/, "Amazon", "amazon"],
  [/^flipkart\.com$/, "Flipkart", "flipkart"],
  [/^swiggy\.com$/, "Swiggy", "swiggy"],
  [/^zomato\.com$/, "Zomato", "zomato"],
];

/**
 * Classify one stored referrer string.
 * An empty value, a literal "Unknown" and a missing field all mean the same
 * thing — the browser sent no referrer — so they collapse into "Direct".
 */
export function normalizeReferrerSource(value) {
  const raw = String(value ?? "").trim();
  if (UNKNOWN_KEYS.has(raw.toLowerCase())) {
    return source("Direct", "Direct", "direct");
  }

  const { host, path, query, ok } = hostOf(raw);
  if (!ok) return source(raw, raw, "other");
  if (!host) return source("Direct", "Direct", "direct");

  if (LOCAL_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
    return source("Development", "Local development", "development", host);
  }

  for (const [pattern, label, kind] of SEARCH) {
    if (!pattern.test(host)) continue;
    // google.com/search vs google.com (a link from Search, Images, Maps…)
    if (kind === "google") {
      const looksLikeSearch = path.includes("/search") || path.includes("/url") || query.includes("q=");
      return looksLikeSearch
        ? source("Google Search", "Google Search", "google", host)
        : source("Google", "Google", "google", host);
    }
    return source(label, label, kind, host);
  }

  for (const [pattern, label, kind] of SOCIAL) {
    if (pattern.test(host)) return source(label, label, kind, host);
  }

  for (const [pattern, label, kind] of SHOPPING) {
    if (pattern.test(host)) return source(label, label, kind, host);
  }

  return source(host, host, "website", host);
}

/**
 * Fold `[{ _id, count }]` facet rows into ranked sources.
 * Several raw URLs can share one source (every google.* variant, or "" and the
 * literal string "Unknown"), so counts are summed per source before ranking —
 * that also removes duplicate display labels.
 */
export function mergeReferrerSources(rows = [], total = 0, top = 8) {
  const groups = new Map();

  for (const row of rows || []) {
    const src = normalizeReferrerSource(row?._id ?? row?.key);
    const existing = groups.get(src.key);
    const count = Number(row?.count) || 0;
    if (existing) {
      existing.count += count;
      if (!existing.host && src.host) existing.host = src.host;
    } else {
      groups.set(src.key, { ...src, count });
    }
  }

  const base = Number(total) > 0 ? Number(total) : 0;
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      kind: group.kind,
      count: group.count,
      share: base > 0 ? Math.round((group.count / base) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, top);
}

/**
 * Re-key a facet by a canonical label function and re-sum the counts.
 * Used for device and OS so `Mobile` / `mobile` stop appearing as two rows.
 */
export function mergeFacetBy(rows = [], labelFn, total = 0, top = 8) {
  const groups = new Map();

  for (const row of rows || []) {
    const key = labelFn(row?._id ?? row?.key);
    groups.set(key, (groups.get(key) || 0) + (Number(row?.count) || 0));
  }

  const base = Number(total) > 0 ? Number(total) : 0;
  return [...groups.entries()]
    .map(([key, count]) => ({
      key,
      count,
      share: base > 0 ? Math.round((count / base) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, top);
}

/* ------------------------------------------------------------------ *
 * UTM campaign attribution.
 *
 * A link shared on an Instagram bio, a LinkedIn post or a GitHub profile
 * often arrives with no browser referrer at all (in-app browsers strip it),
 * so it would silently read as "Direct". A `utm_source` tag on the URL is
 * the owner's own explicit attribution and therefore wins over the referrer.
 * ------------------------------------------------------------------ */

const UTM_MAX = 60;

/** Trim, strip control characters and bound one UTM value. Empty means absent. */
export function sanitizeUtm(value) {
  let raw = String(value ?? "").trim();
  raw = [...raw].filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f).join("");
  if (!raw || /^unknown$/i.test(raw) || raw === "-" || raw === "(none)") return "";
  return raw.length > UTM_MAX ? raw.slice(0, UTM_MAX) : raw;
}

/**
 * Common short links people actually use, mapped to the same source keys the
 * referrer classifier emits — so `utm_source=instagram-bio` and an Instagram
 * referrer both land on the one "Instagram" row with the one real logo.
 * Anything else stays its own named campaign; never guessed into a brand.
 */
const UTM_BRANDS = [
  [/\b(ig|instagram)\b/i, "Instagram", "instagram"],
  [/\b(li|linkedin)\b/i, "LinkedIn", "linkedin"],
  [/\b(gh|github)\b/i, "GitHub", "github"],
  [/\b(x|twitter|twt|tweet)\b/i, "X (Twitter)", "x"],
  [/\b(google|goog)\b/i, "Google", "google"],
  [/\b(yt|youtube)\b/i, "YouTube", "youtube"],
  [/\b(fb|facebook)\b/i, "Facebook", "facebook"],
  [/\b(reddit)\b/i, "Reddit", "reddit"],
  [/\b(tiktok|tt)\b/i, "TikTok", "tiktok"],
  [/\b(ddg|duckduckgo)\b/i, "DuckDuckGo", "duckduckgo"],
  [/\b(bing)\b/i, "Bing", "bing"],
  [/\b(telegram|tg)\b/i, "Telegram", "telegram"],
  [/\b(discord)\b/i, "Discord", "discord"],
  [/\b(medium)\b/i, "Medium", "medium"],
  [/\b(quora)\b/i, "Quora", "quora"],
  [/\b(pinterest|pin)\b/i, "Pinterest", "pinterest"],
];

function utmCampaign(value) {
  const key = sanitizeUtm(value);
  if (!key) return null;
  for (const [pattern, label, kind] of UTM_BRANDS) {
    if (pattern.test(key)) return source(label, label, kind);
  }
  return source(key, key, "campaign");
}

/**
 * Resolve one already-stored traffic-source key, or a raw referrer string
 * from an older record, to `{ key, label, kind }`.
 *
 * Keys without a dot or scheme came from `trafficSourceKey` — either a
 * resolved source ("Google", "Direct") or a UTM campaign name. Anything
 * that looks like a URL goes through the full referrer classifier.
 */
export function resolveTrafficKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return source("Direct", "Direct", "direct");

  if (/^https?:\/\//i.test(raw) || raw.includes(".")) {
    return normalizeReferrerSource(raw);
  }
  if (/^direct$/i.test(raw)) return source("Direct", "Direct", "direct");
  if (/^development$/i.test(raw)) return source("Development", "Local development", "development");
  return utmCampaign(raw) || source(raw, raw, "campaign");
}

/**
 * The single source of truth for one visit, written at track time.
 * UTM wins; without it the browser referrer decides.
 */
export function resolveTrafficSource({ referrer, utmSource } = {}) {
  const campaign = utmCampaign(utmSource);
  if (campaign) return campaign;
  return normalizeReferrerSource(referrer);
}

/**
 * Fold a `trafficSourceKey` facet (with older rows falling back to their raw
 * referrer) into ranked sources. Campaign and brand rows share one key, so
 * `utm_source=instagram-bio` and a real Instagram referrer sum together.
 */
export function mergeTrafficSources(rows = [], total = 0, top = 8) {
  const groups = new Map();

  for (const row of rows || []) {
    const src = resolveTrafficKey(row?._id ?? row?.key);
    const existing = groups.get(src.key);
    const count = Number(row?.count) || 0;
    if (existing) {
      existing.count += count;
    } else {
      groups.set(src.key, { ...src, count });
    }
  }

  const base = Number(total) > 0 ? Number(total) : 0;
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      kind: group.kind,
      count: group.count,
      share: base > 0 ? Math.round((group.count / base) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, top);
}
