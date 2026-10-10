import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeFacetBy,
  mergeReferrerSources,
  mergeTrafficSources,
  normalizeReferrerSource,
  resolveTrafficKey,
  resolveTrafficSource,
  sanitizeUtm,
} from "../src/visitorReferrer.js";
import { facetLabel, normalizeDeviceLabel, normalizeOsLabel, normalizeBrowserLabel } from "../src/visitorQuery.js";

test("empty, null and literal Unknown all collapse to Direct", () => {
  for (const value of [null, undefined, "", "   ", "Unknown", "unknown", "(direct)", "DIRECT", "-", "none", "null", "undefined"]) {
    const src = normalizeReferrerSource(value);
    assert.equal(src.key, "Direct");
    assert.equal(src.kind, "direct");
    assert.equal(src.label, "Direct");
  }
});

test("Google Search is separated from a plain google.com link", () => {
  assert.equal(normalizeReferrerSource("https://www.google.com/search?q=portfolio").label, "Google Search");
  assert.equal(normalizeReferrerSource("https://www.google.com/search?q=portfolio").kind, "google");
  assert.equal(normalizeReferrerSource("https://www.google.co.in/url?q=x").label, "Google Search");
  assert.equal(normalizeReferrerSource("https://google.com/?q=naitik").label, "Google Search");
  assert.equal(normalizeReferrerSource("https://www.google.com/").label, "Google");
  assert.equal(normalizeReferrerSource("https://images.google.com/").label, "Google");
});

test("every google domain variant folds into the same two keys", () => {
  const keys = ["https://www.google.com/", "https://google.co.in/", "https://www.google.co.uk/"].map(
    (url) => normalizeReferrerSource(url).key
  );
  assert.deepEqual(keys, ["Google", "Google", "Google"]);
  assert.equal(normalizeReferrerSource("https://images.google.com/").key, "Google");
  // A media host, not a search property.
  assert.equal(normalizeReferrerSource("https://lh3.googleusercontent.com/x.png").kind, "website");
});

test("localhost and loopback addresses become Local development", () => {
  for (const value of ["http://localhost:5173/", "https://localhost/", "http://127.0.0.1:5173/", "http://0.0.0.0:3000/", "http://my-app.local/"]) {
    const src = normalizeReferrerSource(value);
    assert.equal(src.kind, "development");
    assert.equal(src.label, "Local development");
  }
});

test("social networks get their own source key", () => {
  assert.equal(normalizeReferrerSource("https://www.instagram.com/p/abc/").key, "Instagram");
  assert.equal(normalizeReferrerSource("https://www.linkedin.com/in/naitik/").key, "LinkedIn");
  assert.equal(normalizeReferrerSource("https://x.com/naitik").key, "X (Twitter)");
  assert.equal(normalizeReferrerSource("https://twitter.com/naitik").key, "X (Twitter)");
  assert.equal(normalizeReferrerSource("https://github.com/NaitikSoni1417").key, "GitHub");
  assert.equal(normalizeReferrerSource("https://youtu.be/xyz").key, "YouTube");
});

test("unparseable text is kept verbatim rather than reshaped", () => {
  const src = normalizeReferrerSource("a random string with no host");
  assert.equal(src.key, "a random string with no host");
  assert.equal(src.kind, "other");
});

test("an unknown host falls back to its hostname", () => {
  const src = normalizeReferrerSource("https://www.some-blog.in/posts/1");
  assert.equal(src.key, "some-blog.in");
  assert.equal(src.kind, "website");
});

test("mergeReferrerSources sums counts across variants of one source", () => {
  const rows = [
    { _id: "https://www.google.com/", count: 10 },
    { _id: "https://www.google.com/search?q=x", count: 30 },
    { _id: "https://google.co.in/search?q=y", count: 20 },
    { _id: "http://localhost:5173/", count: 5 },
    { _id: "", count: 40 },
    { _id: "Unknown", count: 7 },
  ];
  const merged = mergeReferrerSources(rows, 112, 8);

  const byKey = Object.fromEntries(merged.map((row) => [row.key, row]));
  assert.equal(byKey["Google Search"].count, 50);
  assert.equal(byKey.Google.count, 10);
  assert.equal(byKey.Direct.count, 47);
  assert.equal(byKey.Development.count, 5);
  assert.equal(byKey.Development.label, "Local development");

  // No duplicate display labels survive the merge.
  const labels = merged.map((row) => row.label);
  assert.equal(new Set(labels).size, labels.length);
});

test("mergeReferrerSources ranks by count and honours the top limit", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ _id: `https://site${i}.com/`, count: i + 1 }));
  const merged = mergeReferrerSources(rows, 210, 3);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].key, "site19.com");
  assert.equal(merged[0].count, 20);
  assert.ok(merged[0].share > 9);
});

test("mergeReferrerSources reports a zero share when the total is zero", () => {
  const merged = mergeReferrerSources([{ _id: "", count: 3 }], 0, 8);
  assert.equal(merged[0].share, 0);
  assert.equal(merged[0].key, "Direct");
});

test("mergeReferrerSources tolerates a missing or empty row list", () => {
  assert.deepEqual(mergeReferrerSources(null, 10, 8), []);
  assert.deepEqual(mergeReferrerSources([], 10, 8), []);
});

test("normalizeDeviceLabel folds case variants of the same device", () => {
  assert.equal(normalizeDeviceLabel("mobile"), "Mobile");
  assert.equal(normalizeDeviceLabel("Mobile"), "Mobile");
  assert.equal(normalizeDeviceLabel("MOBILE"), "Mobile");
  assert.equal(normalizeDeviceLabel("desktop"), "Desktop");
  assert.equal(normalizeDeviceLabel("SmartTV"), "Smart TV");
  assert.equal(normalizeDeviceLabel(null), "Unknown");
  assert.equal(normalizeDeviceLabel(""), "Unknown");
});

test("normalizeDeviceLabel title-cases an unrecognised value instead of inventing one", () => {
  assert.equal(normalizeDeviceLabel("wearable"), "Wearable");
  assert.equal(normalizeDeviceLabel("fridge"), "Fridge");
});

test("normalizeOsLabel folds version suffixes into an OS family", () => {
  assert.equal(normalizeOsLabel("Windows 11"), "Windows");
  assert.equal(normalizeOsLabel("windows 10"), "Windows");
  assert.equal(normalizeOsLabel("Mac OS X 10.15"), "macOS");
  assert.equal(normalizeOsLabel("macOS 15.4"), "macOS");
  assert.equal(normalizeOsLabel("iOS 18"), "iOS");
  assert.equal(normalizeOsLabel("Android 15"), "Android");
  assert.equal(normalizeOsLabel("Ubuntu 24.04"), "Ubuntu");
  assert.equal(normalizeOsLabel("Other"), "Unknown");
  assert.equal(normalizeOsLabel(null), "Unknown");
});

test("normalizeOsLabel keeps an unrecognised value verbatim", () => {
  assert.equal(normalizeOsLabel("Haiku OS"), "Haiku OS");
});

test("facetLabel trims, bounds and defaults to Unknown", () => {
  assert.equal(facetLabel(null), "Unknown");
  assert.equal(facetLabel("  Chrome 150  "), "Chrome 150");
  assert.equal(facetLabel("x".repeat(100), 10).length, 10);
  assert.ok(facetLabel("x".repeat(100), 10).endsWith("…"));
});

test("mergeFacetBy re-keys, re-sums and re-ranks a facet", () => {
  const rows = [
    { _id: "mobile", count: 382 },
    { _id: "Mobile", count: 1044 },
    { _id: "desktop", count: 2100 },
  ];
  const merged = mergeFacetBy(rows, normalizeDeviceLabel, 3526, 8);
  assert.equal(merged[0].key, "Desktop");
  assert.equal(merged[1].key, "Mobile");
  assert.equal(merged[1].count, 1426);
  assert.ok(merged[0].share > 59 && merged[0].share < 60);
});

test("normalizeBrowserLabel folds every Chrome version into one family", () => {
  assert.equal(normalizeBrowserLabel("Chrome 150"), "Chrome");
  assert.equal(normalizeBrowserLabel("Chrome 154"), "Chrome");
  assert.equal(normalizeBrowserLabel("Mobile Chrome 151"), "Chrome");
  assert.equal(normalizeBrowserLabel("Chrome Headless 131"), "Chrome");
  assert.equal(normalizeBrowserLabel("CriOS 319"), "Chrome");
  assert.equal(normalizeBrowserLabel("Chromium 140"), "Chrome");
});

test("normalizeBrowserLabel keeps one family per real browser", () => {
  assert.equal(normalizeBrowserLabel("Safari"), "Safari");
  assert.equal(normalizeBrowserLabel("Mobile Safari 26"), "Safari");
  assert.equal(normalizeBrowserLabel("Safari 26"), "Safari");
  assert.equal(normalizeBrowserLabel("Firefox"), "Firefox");
  assert.equal(normalizeBrowserLabel("Firefox 152"), "Firefox");
  assert.equal(normalizeBrowserLabel("FxiOS 142"), "Firefox");
  assert.equal(normalizeBrowserLabel("Edge 151"), "Edge");
  assert.equal(normalizeBrowserLabel("Edge"), "Edge");
  assert.equal(normalizeBrowserLabel("Edg 131.0 Chrome 131"), "Edge");
  assert.equal(normalizeBrowserLabel("Opera 83"), "Opera");
  assert.equal(normalizeBrowserLabel("OPR 116.0 Chrome 131"), "Opera");
  assert.equal(normalizeBrowserLabel("Samsung Internet 30"), "Samsung Internet");
  assert.equal(normalizeBrowserLabel("Brave 1.74 Chrome 131"), "Brave");
  assert.equal(normalizeBrowserLabel("Vivaldi 7.0 Chrome 130"), "Vivaldi");
});

test("normalizeBrowserLabel detects in-app browsers that hide another engine", () => {
  // Instagram and Yahoo ship a UA that also contains Safari/Chrome tokens;
  // they must win over the generic engine they embed.
  assert.equal(normalizeBrowserLabel("Instagram 312.0.0.0.100 Mobile Safari"), "Instagram");
  assert.equal(normalizeBrowserLabel("YahooBrowser/7.5 Mobile Safari"), "Yahoo Browser");
  assert.equal(normalizeBrowserLabel("Tor Browser 13.0 Firefox/128.0"), "Tor");
});

test("normalizeBrowserLabel maps tooling and scrapers to Bot, never invents a family", () => {
  assert.equal(normalizeBrowserLabel("curl/8.5.0"), "Bot");
  assert.equal(normalizeBrowserLabel("python-requests/2.31"), "Bot");
  assert.equal(normalizeBrowserLabel("Googlebot/2.1"), "Bot");
  assert.equal(normalizeBrowserLabel("Netscape Navigator 3"), "Netscape Navigator 3");
  assert.equal(normalizeBrowserLabel(null), "Unknown");
  assert.equal(normalizeBrowserLabel(""), "Unknown");
});

test("mergeFacetBy collapses a browser facet to readable families", () => {
  const rows = [
    { _id: "Chrome", count: 1126 },
    { _id: "Chrome 150", count: 831 },
    { _id: "Chrome 151", count: 613 },
    { _id: "Mobile Chrome 151", count: 334 },
    { _id: "Chrome Headless 131", count: 41 },
    { _id: "Mobile Safari 26", count: 55 },
    { _id: "Safari", count: 39 },
    { _id: "Edge 151", count: 27 },
    { _id: "Samsung Internet 30", count: 24 },
    { _id: "Opera 83", count: 6 },
    { _id: "Firefox 152", count: 6 },
    { _id: null, count: 337 },
  ];
  const merged = mergeFacetBy(rows, normalizeBrowserLabel, 5126, 8);
  assert.deepEqual(
    merged.map((row) => row.key),
    ["Chrome", "Unknown", "Safari", "Edge", "Samsung Internet", "Firefox", "Opera"]
  );
  assert.equal(merged[0].count, 2945, "every Chrome variant summed into one row");
  assert.equal(merged[1].count, 337, "null folds to Unknown");
  assert.equal(merged[2].count, 94, "Mobile Safari + Safari");
  assert.equal(merged[0].share, 57.5);
});

// ── UTM campaign attribution ────────────────────────────────────────────────

test("sanitizeUtm trims, strips control characters and bounds the value", () => {
  assert.equal(sanitizeUtm("  instagram-bio  "), "instagram-bio");
  assert.equal(sanitizeUtm(""), "");
  assert.equal(sanitizeUtm(null), "");
  assert.equal(sanitizeUtm(undefined), "");
  assert.equal(sanitizeUtm("unknown"), "");
  assert.equal(sanitizeUtm("Unknown"), "");
  assert.equal(sanitizeUtm("-"), "");
  assert.equal(sanitizeUtm("(none)"), "");
  assert.equal(sanitizeUtm("x".repeat(100)).length, 60);
});

test("resolveTrafficSource lets a UTM campaign win over the referrer", () => {
  const fromUtm = resolveTrafficSource({
    referrer: "",
    utmSource: "instagram-bio",
  });
  assert.equal(fromUtm.key, "Instagram", "instagram-bio folds into the Instagram brand");
  assert.equal(fromUtm.kind, "instagram");

  const noUtm = resolveTrafficSource({
    referrer: "https://www.google.com/search?q=naitik",
    utmSource: "",
  });
  assert.equal(noUtm.key, "Google Search");

  const direct = resolveTrafficSource({ referrer: "Direct", utmSource: "" });
  assert.equal(direct.key, "Direct");
  assert.equal(direct.kind, "direct");
});

test("resolveTrafficSource maps short UTM tokens to their brand", () => {
  assert.equal(resolveTrafficSource({ utmSource: "ig" }).kind, "instagram");
  assert.equal(resolveTrafficSource({ utmSource: "li" }).kind, "linkedin");
  assert.equal(resolveTrafficSource({ utmSource: "gh" }).kind, "github");
  assert.equal(resolveTrafficSource({ utmSource: "yt" }).kind, "youtube");
  assert.equal(resolveTrafficSource({ utmSource: "twitter" }).kind, "x");
});

test("an unrecognised UTM source stays its own named campaign, never a brand", () => {
  const campaign = resolveTrafficSource({
    referrer: "",
    utmSource: "ns-newsletter-march",
  });
  assert.equal(campaign.key, "ns-newsletter-march");
  assert.equal(campaign.kind, "campaign");
  assert.equal(campaign.label, "ns-newsletter-march");
});

test("resolveTrafficKey handles stored keys and legacy raw referrers alike", () => {
  assert.equal(resolveTrafficKey("").key, "Direct");
  assert.equal(resolveTrafficKey("Direct").kind, "direct");
  assert.equal(resolveTrafficKey("Development").kind, "development");
  assert.equal(resolveTrafficKey("https://www.google.com/").kind, "google");
  assert.equal(resolveTrafficKey("instagram-bio").kind, "instagram");
  assert.equal(resolveTrafficKey("custom-campaign").kind, "campaign");
});

test("mergeTrafficSources ranks sources and folds campaign variants into brands", () => {
  const rows = [
    { _id: "Direct", count: 400 },
    { _id: "instagram-bio", count: 250 },
    { _id: "instagram", count: 150 },
    { _id: "https://www.google.com/", count: 300 },
    { _id: "https://github.com/naitiksoni1417", count: 100 },
    { _id: "linkedin-post", count: 80 },
    { _id: "ns-newsletter", count: 40 },
  ];
  const merged = mergeTrafficSources(rows, 1320, 8);

  assert.deepEqual(
    merged.map((r) => r.key),
    ["Direct", "Instagram", "Google", "GitHub", "LinkedIn", "ns-newsletter"]
  );
  assert.equal(merged[0].count, 400);
  assert.equal(merged[1].count, 400, "instagram-bio + instagram summed into one brand row");
  assert.equal(merged[1].kind, "instagram");
  assert.equal(merged[5].kind, "campaign", "unrecognised campaign keeps its own kind");
  assert.equal(merged[0].share, 30.3);
});

test("mergeTrafficSources tolerates empty rows and a zero total", () => {
  assert.deepEqual(mergeTrafficSources([], 100, 5), []);
  const merged = mergeTrafficSources([{ _id: "Direct", count: 3 }], 0, 5);
  assert.equal(merged[0].share, 0);
});
