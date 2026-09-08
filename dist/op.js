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

// ../MitarashiDango_Extensions/extensions/op/index.ts
var index_exports = {};
__export(index_exports, {
  OpExtension: () => OpExtension,
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

// ../MitarashiDango_Extensions/extensions/op/index.ts
var metadata = {
  id: "op",
  name: "OP",
  version: "1.0.0",
  type: "anime",
  lang: "en",
  mature: true,
  description: "Mature anime from OppaiStream"
};
var BASE_URL = "https://oppai.stream";
var OpExtension = class {
  metadata = metadata;
  cache = new SimpleCache();
  async search(options) {
    if (!options.query) return [];
    try {
      const res = await fetch(`${BASE_URL}/actions/search.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: BASE_URL + "/",
          "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"
        },
        body: `q=${encodeURIComponent(options.query)}`,
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) return [];
      const html = await res.text();
      const entries = [];
      const re = /<div\s+class='in-grid episode-shown'[^>]*folder='([^']+)'[^>]*name='([^']+)'[^>]*desc='([^']*)'/g;
      let m;
      const seen = /* @__PURE__ */ new Set();
      while ((m = re.exec(html)) !== null) {
        const folder = m[1];
        const name = m[2];
        if (!seen.has(folder)) {
          seen.add(folder);
          entries.push({
            _id: folder,
            id: folder,
            name,
            englishName: name,
            type: "OVA",
            isAdult: true
          });
        }
      }
      return entries;
    } catch {
      return [];
    }
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
    return {
      episodes: ["1"],
      description: ""
    };
  }
  async getStreamUrls(showId, episodeNumber) {
    return [];
  }
};
var index_default = new OpExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OpExtension,
  metadata
});
