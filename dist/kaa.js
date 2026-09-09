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

// extensions/kaa/index.ts
var index_exports = {};
__export(index_exports, {
  KaaExtension: () => KaaExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);

// packages/core/src/index.ts
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

// extensions/kaa/index.ts
var metadata = {
  id: "kaa",
  name: "KAA",
  version: "1.0.0",
  type: "anime",
  lang: "en",
  mature: false,
  description: "Anime streams from KAA / Krussdomi with Vidstream and Catstream servers"
};
var KAA_BASE = "https://kaa.lt";
var KAA_HLS_BASE = "https://hls.krussdomi.com";
var KAA_REFERER = "https://krussdomi.com/";
var KAA_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var KAA_HEADERS = {
  "User-Agent": KAA_UA,
  Referer: "https://kaa.lt/",
  Origin: "https://kaa.lt",
  Accept: "application/json"
};
var KaaExtension = class {
  metadata = metadata;
  cache = new SimpleCache();
  langFor(mode) {
    return mode === "dub" ? "en-US" : "ja-JP";
  }
  stripSlug(raw) {
    return raw.replace(/^kaa[_-]/i, "").trim();
  }
  async kaaSearch(query) {
    const res = await fetch(`${KAA_BASE}/api/fsearch?q=${encodeURIComponent(query)}`, {
      headers: KAA_HEADERS,
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) throw new Error(`KAA fsearch HTTP ${res.status} for "${query}"`);
    const data = await res.json();
    return Array.isArray(data?.result) ? data.result : [];
  }
  async kaaShowInfo(slug) {
    const res = await fetch(`${KAA_BASE}/api/show/${encodeURIComponent(slug)}`, {
      headers: KAA_HEADERS,
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) throw new Error(`KAA show HTTP ${res.status}: ${slug}`);
    return await res.json();
  }
  async kaaEpisodePage(slug, ep, lang) {
    const res = await fetch(
      `${KAA_BASE}/api/show/${encodeURIComponent(slug)}/episodes?ep=${ep}&lang=${encodeURIComponent(lang)}`,
      { headers: KAA_HEADERS, signal: AbortSignal.timeout(15e3) }
    );
    if (!res.ok) throw new Error(`KAA episodes HTTP ${res.status}: ${slug}`);
    return await res.json();
  }
  async kaaAllEpisodes(slug, lang) {
    const first = await this.kaaEpisodePage(slug, 1, lang);
    const pages = Array.isArray(first.pages) ? first.pages : [];
    const all = Array.isArray(first.result) ? [...first.result] : [];
    if (pages.length > 1) {
      const rest = await Promise.all(
        pages.slice(1).map(async (pg) => {
          const startEp = pg.eps?.[0];
          if (startEp == null) return [];
          try {
            const d = await this.kaaEpisodePage(slug, startEp, lang);
            return Array.isArray(d.result) ? d.result : [];
          } catch {
            return [];
          }
        })
      );
      for (const batch of rest) all.push(...batch);
    }
    return all;
  }
  async kaaEpisodeServers(showSlug, epSlug) {
    const res = await fetch(
      `${KAA_BASE}/api/show/${encodeURIComponent(showSlug)}/episode/${encodeURIComponent(epSlug)}`,
      { headers: KAA_HEADERS, signal: AbortSignal.timeout(15e3) }
    );
    if (!res.ok) throw new Error(`KAA servers HTTP ${res.status}: ${showSlug}/${epSlug}`);
    return await res.json();
  }
  async buildEpMap(slug, show, lang) {
    const episodes = await this.kaaAllEpisodes(slug, lang);
    const map = episodes.filter((e) => Number.isInteger(e.episode_number) && e.episode_number >= 1 && e.slug).map((e) => ({
      number: e.episode_number,
      fullSlug: `ep-${e.episode_number}-${e.slug}`
    }));
    if (map.length > 0) return map;
    if (show?.type === "movie" && show?.watch_uri) {
      const m = show.watch_uri.match(/\/(ep-(\d+)-([a-f0-9]+))$/i);
      if (m) return [{ number: 1, fullSlug: m[1] }];
    }
    return [];
  }
  proxyUrl(rawUrl) {
    return `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(KAA_REFERER)}`;
  }
  parsePlayerSubtitles(html) {
    const seen = /* @__PURE__ */ new Set();
    const tracks = [];
    const objRe = /\[0,\{([^}]*)\}\]/g;
    let obj;
    while ((obj = objRe.exec(html)) !== null) {
      const block = obj[1];
      const langM = block.match(/"language"\s*:\s*\[0\s*,\s*"([^"]+)"/);
      const nameM = block.match(/"name"\s*:\s*\[0\s*,\s*"([^"]+)"/);
      const srcM = block.match(/"src"\s*:\s*\[0\s*,\s*"(https?:\/\/[^"]+\.(?:srt|vtt)[^"]*)"/);
      if (!srcM) continue;
      const url = srcM[1].replace(/^https:\/\/\//, "https://");
      if (seen.has(url)) continue;
      seen.add(url);
      tracks.push({
        language: langM?.[1] || "en",
        label: nameM?.[1] || langM?.[1] || "English",
        url
      });
    }
    return tracks;
  }
  async fetchCatStreamData(playerSrc) {
    let masterUrl = null;
    const subtitles = [];
    try {
      const res = await fetch(playerSrc, {
        headers: {
          "User-Agent": KAA_UA,
          Referer: "https://kaa.lt/",
          Origin: "https://kaa.lt",
          Accept: "text/html"
        },
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) return { masterUrl, subtitles };
      const html = (await res.text()).replace(/&quot;/g, '"');
      const manifestMatch = html.match(/"manifest"\s*:\s*\[0\s*,\s*"(\/\/[^"]+\.m3u8[^"]*)"\]/);
      if (manifestMatch) masterUrl = manifestMatch[1].replace(/^\/\//, "https://");
      subtitles.push(...this.parsePlayerSubtitles(html));
    } catch {
    }
    return { masterUrl, subtitles };
  }
  async getMasterLevels(masterUrl) {
    try {
      const res = await fetch(masterUrl, {
        headers: { Referer: KAA_REFERER, Origin: "https://krussdomi.com", "User-Agent": KAA_UA },
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) return [];
      const text = await res.text();
      const levels = [];
      const lines = text.split("\n");
      let index = 0;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
        const nameMatch = line.match(/NAME="([^"]+)"/) || line.match(/RESOLUTION=\d+x(\d+)/);
        let label = nameMatch ? nameMatch[1] : "HD";
        label = label.endsWith("p") ? label : `${label}p`;
        levels.push({ index: index++, label });
      }
      return levels;
    } catch {
      return [];
    }
  }
  async fetchSubtitles(playerSrc) {
    try {
      const res = await fetch(playerSrc, {
        headers: {
          "User-Agent": KAA_UA,
          Referer: "https://kaa.lt/",
          Origin: "https://kaa.lt",
          Accept: "text/html"
        },
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) return [];
      const html = (await res.text()).replace(/&quot;/g, '"');
      return this.parsePlayerSubtitles(html);
    } catch {
      return [];
    }
  }
  async search(options) {
    if (!options.query) return [];
    try {
      const items = await this.kaaSearch(options.query);
      return items.map((item) => ({
        _id: item.slug,
        id: item.slug,
        name: item.title || item.slug,
        thumbnail: item.image,
        type: item.type,
        episodeCount: item.episode_count,
        year: item.year
      }));
    } catch {
      return [];
    }
  }
  async resolveShowId(title, romaji) {
    const targets = [title, romaji].filter((t) => Boolean(t && t.trim()));
    const queries = buildQueryVariants(title, romaji);
    for (const q of queries) {
      try {
        const items = await this.kaaSearch(q);
        if (!items.length) continue;
        const match = pickBestMatch(
          items.map((i) => ({ title: i.title || "", id: i.slug })),
          targets,
          0.6
        );
        if (match?.item.id) return match.item.id;
      } catch {
      }
    }
    return null;
  }
  async getEpisodes(showId, mode = "sub") {
    try {
      const slug = this.stripSlug(showId);
      if (!slug) return null;
      const cacheKey = `kaa_eps_${slug}_${mode}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
      const show = await this.kaaShowInfo(slug);
      const locales = Array.isArray(show.locales) ? show.locales : [];
      if (mode === "dub" && !locales.includes("en-US")) return null;
      const epMap = await this.buildEpMap(slug, show, this.langFor(mode));
      if (!epMap.length) return null;
      const episodes = epMap.map((e) => String(e.number));
      const result = { episodes, description: "" };
      this.cache.set(cacheKey, result, 3600);
      return result;
    } catch {
      return null;
    }
  }
  async getStreamUrls(showId, episodeNumber, mode = "sub") {
    try {
      const slug = this.stripSlug(showId);
      if (!slug) return null;
      const epNum = Number(episodeNumber);
      if (!Number.isInteger(epNum) || epNum < 1) return null;
      const cacheKey = `kaa_stream_${slug}_${epNum}_${mode}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
      const show = await this.kaaShowInfo(slug);
      const locales = Array.isArray(show.locales) ? show.locales : [];
      if (mode === "dub" && !locales.includes("en-US")) return null;
      const epMap = await this.buildEpMap(slug, show, this.langFor(mode));
      const ep = epMap.find((e) => e.number === epNum);
      if (!ep) return null;
      const episodeData = await this.kaaEpisodeServers(slug, ep.fullSlug);
      const servers = Array.isArray(episodeData.servers) ? episodeData.servers : [];
      if (!servers.length) return null;
      const sources = [];
      let playerSrc = "";
      let catStreamData = null;
      for (const s of servers) {
        const src = s.src || "";
        const isVidstream = src.includes("source=vidstream");
        const isCatstream = src.includes("source=catstream");
        if (!isVidstream && !isCatstream) continue;
        const m = src.match(/[?&]id=([^&]+)/);
        if (!m) continue;
        if (!playerSrc) playerSrc = src;
        if (isCatstream) {
          if (!catStreamData) catStreamData = await this.fetchCatStreamData(src);
          if (!catStreamData?.masterUrl) continue;
          const masterUrl2 = catStreamData.masterUrl;
          const linkHeaders2 = { Referer: KAA_REFERER };
          const links2 = [];
          for (const level of await this.getMasterLevels(masterUrl2)) {
            links2.push({
              resolutionStr: level.label,
              link: `/api/proxy?url=${encodeURIComponent(masterUrl2)}&referer=${encodeURIComponent(KAA_REFERER)}&variant=${level.index}`,
              hls: true,
              headers: linkHeaders2
            });
          }
          links2.push({
            resolutionStr: "Auto",
            link: this.proxyUrl(masterUrl2),
            hls: true,
            headers: linkHeaders2
          });
          sources.push({
            sourceName: s.name ? `KAA ${s.name}` : "KAA",
            links: links2,
            type: "player",
            actualEpisodeNumber: String(epNum)
          });
          continue;
        }
        const masterUrl = `${KAA_HLS_BASE}/${m[1]}/master.m3u8`;
        const linkHeaders = { Referer: KAA_REFERER };
        const links = [];
        for (const level of await this.getMasterLevels(masterUrl)) {
          links.push({
            resolutionStr: level.label,
            link: `/api/proxy?url=${encodeURIComponent(masterUrl)}&referer=${encodeURIComponent(KAA_REFERER)}&variant=${level.index}`,
            hls: true,
            headers: linkHeaders
          });
        }
        links.push({
          resolutionStr: "Auto",
          link: this.proxyUrl(masterUrl),
          hls: true,
          headers: linkHeaders
        });
        sources.push({
          sourceName: s.name ? `KAA ${s.name}` : "KAA",
          links,
          type: "player",
          actualEpisodeNumber: String(epNum)
        });
      }
      if (!sources.length) return null;
      const subtitles = [];
      const seen = /* @__PURE__ */ new Set();
      const push = (list) => {
        for (const t of list || []) {
          if (seen.has(t.url)) continue;
          seen.add(t.url);
          subtitles.push(t);
        }
      };
      push(catStreamData?.subtitles);
      if (!subtitles.length && playerSrc) {
        push(await this.fetchSubtitles(playerSrc));
      }
      if (subtitles.length) {
        for (const src of sources) src.subtitles = subtitles;
      }
      this.cache.set(cacheKey, sources, 3600);
      return sources;
    } catch {
      return null;
    }
  }
};
var index_default = new KaaExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  KaaExtension,
  metadata
});
