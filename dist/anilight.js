"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../MitarashiDango_Extensions/extensions/anilight/index.ts
var index_exports = {};
__export(index_exports, {
  AnilightExtension: () => AnilightExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);

// ../MitarashiDango_Extensions/packages/core/src/index.ts
var SimpleCache = class {
  store = /* @__PURE__ */ new Map();
  get(key) {
    const item = this.store.get(key);
    if (!item) return void 0;
    if (Date.now() > item.exp) {
      this.store.delete(key);
      return void 0;
    }
    return item.val;
  }
  set(key, val, ttlSeconds = 3600) {
    this.store.set(key, { val, exp: Date.now() + ttlSeconds * 1e3 });
  }
  del(key) {
    this.store.delete(key);
  }
};
function normalizeCompact(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function tokenize(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 2);
}
function bigramDice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const grams = (s) => {
    const map = /* @__PURE__ */ new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) || 0) + 1);
    }
    return map;
  };
  const A = grams(a);
  const B = grams(b);
  let totalA = 0;
  let totalB = 0;
  let shared = 0;
  A.forEach((c) => totalA += c);
  B.forEach((c) => totalB += c);
  A.forEach((c, g) => {
    const other = B.get(g);
    if (other) shared += Math.min(c, other);
  });
  return 2 * shared / (totalA + totalB);
}
var STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "animation",
  "no",
  "wa",
  "ga",
  "wo",
  "ni",
  "de",
  "to",
  "e",
  "o",
  "x",
  "ii",
  "yo",
  "ova",
  "oad",
  "hd",
  "ep",
  "episode",
  "season",
  "part",
  "hen",
  "a"
]);
function distinctiveTokens(s) {
  return [...new Set(tokenize(s).filter((w) => !STOPWORDS.has(w)))];
}
function titleSimilarity(query, candidate) {
  const q = normalizeCompact(query);
  const c = normalizeCompact(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  let score = bigramDice(q, c);
  if (q.startsWith(c) || c.startsWith(q)) {
    const prefixScore = 0.5 + 0.5 * (Math.min(q.length, c.length) / Math.max(q.length, c.length));
    if (prefixScore > score) score = prefixScore;
  }
  const qD = distinctiveTokens(query);
  const cD = distinctiveTokens(candidate);
  if (qD.length > 0 && cD.length >= 2) {
    const cSet = new Set(cD);
    let hits = 0;
    for (const t of qD) {
      if (cSet.has(t)) hits++;
    }
    const coverage = hits / Math.min(qD.length, cD.length);
    if (coverage > score) score = coverage;
  }
  return score >= 1 ? 0.99 : score;
}
function pickBestMatch(candidates, targets, minScore = 0.6) {
  if (!candidates.length) return null;
  const cleanTargets = targets.filter((t) => !!t && t.trim().length > 0);
  if (!cleanTargets.length) return null;
  let best = null;
  for (const item of candidates) {
    if (!item.title) continue;
    let score = 0;
    for (const target of cleanTargets) {
      const s = titleSimilarity(target, item.title);
      if (s > score) score = s;
    }
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= minScore ? best : null;
}
function buildQueryVariants(title, romaji) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const push = (q) => {
    const v = q.replace(/\s+/g, " ").trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  };
  if (romaji && romaji.trim()) push(romaji);
  push(title);
  const stripped = (s) => s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  push(stripped(title));
  if (romaji) push(stripped(romaji));
  const words = stripped(title).split(/\s+/).filter(Boolean);
  if (words.length > 3) push(words.slice(0, 3).join(" "));
  if (words.length > 4) push(words.slice(0, 4).join(" "));
  const tokens = distinctiveTokens(title).concat(romaji ? distinctiveTokens(romaji) : []).filter((w) => w.length >= 4);
  const unique = [...new Set(tokens)];
  unique.sort((a, b) => b.length - a.length);
  for (const t of unique.slice(0, 4)) push(t);
  return out;
}

// ../MitarashiDango_Extensions/extensions/anilight/index.ts
var import_node_child_process = require("node:child_process");
var metadata = {
  id: "anilight",
  name: "Anilight",
  version: "1.0.0",
  type: "anime",
  lang: "en",
  mature: false,
  description: "Fast HLS anime streams from Anilight"
};
var API_BASE = "https://api.anilight.live/api";
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
function curlGet(url) {
  try {
    const args = [
      "-sSL",
      "-A",
      BROWSER_UA,
      "-H",
      "Referer: https://anilight.live/",
      "-H",
      "Origin: https://anilight.live",
      "-H",
      "Accept: application/json,text/plain,*/*",
      "--max-time",
      "15",
      url
    ];
    const out = (0, import_node_child_process.execFileSync)("curl", args, { encoding: "utf-8" });
    return JSON.parse(out);
  } catch {
    return null;
  }
}
var AnilightExtension = class {
  metadata = metadata;
  cache = new SimpleCache();
  async search(options) {
    if (!options.query) return [];
    const cacheKey = "search_" + options.query;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const data = curlGet(`${API_BASE}/search?query=${encodeURIComponent(options.query)}`);
    const list = data?.data || (Array.isArray(data) ? data : []);
    const results = list.map((item) => ({
      _id: String(item.id || item.slug),
      id: String(item.id || item.slug),
      name: item.title || item.name || "",
      englishName: item.englishTitle || item.title,
      thumbnail: item.poster || item.image || item.cover,
      type: item.format || "TV"
    }));
    this.cache.set(cacheKey, results, 1800);
    return results;
  }
  async resolveShowId(title, romaji) {
    const variants = buildQueryVariants(title, romaji);
    for (const q of variants) {
      try {
        const results = await this.search({ query: q });
        const match = pickBestMatch(
          results.map((r) => ({ title: r.name, id: r._id })),
          [title, romaji].filter((t) => !!t)
        );
        if (match) return match.item.id || null;
      } catch {
      }
    }
    return null;
  }
  async getEpisodes(showId) {
    const cacheKey = "episodes_" + showId;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const data = curlGet(`${API_BASE}/anime/${encodeURIComponent(showId)}/episodes`);
    const list = data?.data || (Array.isArray(data) ? data : []);
    const episodes = list.map((ep) => String(ep.episodeNumber || ep.number || ep));
    const result = { episodes, description: "" };
    this.cache.set(cacheKey, result, 1800);
    return result;
  }
  async getStreamUrls(showId, episodeNumber) {
    const data = curlGet(`${API_BASE}/anime/${encodeURIComponent(showId)}/episode/${episodeNumber}/sources`);
    const sourcesList = data?.data || (Array.isArray(data) ? data : []);
    const out = [];
    for (const s of sourcesList) {
      const url = s.url || s.streamUrl;
      if (url) {
        out.push({
          sourceName: `Anilight (${s.quality || "Auto"})`,
          links: [
            {
              resolutionStr: s.quality || "Auto",
              link: url,
              hls: url.includes(".m3u8")
            }
          ],
          type: "player"
        });
      }
    }
    return out;
  }
};
var index_default = new AnilightExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AnilightExtension,
  metadata
});
