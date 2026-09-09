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

// extensions/megaplay/index.ts
var index_exports = {};
__export(index_exports, {
  MegaPlayExtension: () => MegaPlayExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var import_crypto = require("crypto");

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

// extensions/megaplay/index.ts
var metadata = {
  id: "megaplay",
  name: "MegaPlay",
  version: "1.1.0",
  type: "anime",
  lang: "en",
  mature: false,
  description: "Direct HLS anime streams from MegaPlay with decrypted sources and sub/dub support"
};
var MegaPlayExtension = class {
  metadata = metadata;
  megaPlayBase = "https://megaplay.buzz/stream/ani";
  megaPlayHeaders = {
    Referer: "https://megaplay.buzz/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };
  cache = new SimpleCache();
  decodeScriptString(raw) {
    return raw.replace(
      /\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|([\\'"bfnrtv]))/g,
      (_, hex, unicode, escaped) => {
        if (hex) return String.fromCharCode(parseInt(hex, 16));
        if (unicode) return String.fromCharCode(parseInt(unicode, 16));
        return {
          "\\": "\\",
          "'": "'",
          '"': '"',
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "	",
          v: "\v"
        }[escaped] ?? escaped;
      }
    );
  }
  getScriptStrings(script) {
    const strings = [];
    let index = 0;
    let previous = "";
    while (index < script.length) {
      const char = script[index];
      if (char === "/" && script[index + 1] === "/") {
        index = script.indexOf("\n", index + 2);
        if (index < 0) break;
        continue;
      }
      if (char === "/" && script[index + 1] === "*") {
        index = script.indexOf("*/", index + 2);
        if (index < 0) break;
        index += 2;
        continue;
      }
      if (char === "/" && /[=(:,[!&|?{};]/.test(previous)) {
        index++;
        let inClass = false;
        while (index < script.length) {
          if (script[index] === "\\") {
            index += 2;
            continue;
          }
          if (script[index] === "[") inClass = true;
          if (script[index] === "]") inClass = false;
          if (script[index] === "/" && !inClass) {
            index++;
            while (/[a-z]/i.test(script[index] ?? "")) index++;
            break;
          }
          index++;
        }
        continue;
      }
      if (char === "'" || char === '"') {
        const quote = char;
        let value = "";
        index++;
        while (index < script.length && script[index] !== quote) {
          if (script[index] === "\\" && index + 1 < script.length) value += script[index++];
          value += script[index++];
        }
        strings.push(this.decodeScriptString(value));
        index++;
        continue;
      }
      if (char === "`") {
        index++;
        while (index < script.length && script[index] !== "`")
          index += script[index] === "\\" ? 2 : 1;
        index++;
        continue;
      }
      if (!/\s/.test(char)) previous = char;
      index++;
    }
    return [...new Set(strings)];
  }
  async getMegaPlayClientScript(pageUrl, html) {
    const cacheKey = "megaplay_client_script";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/gi)].map(
      (m) => new URL(m[1], pageUrl).href
    );
    const scripts = await Promise.all(
      scriptUrls.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: { ...this.megaPlayHeaders, Referer: pageUrl },
            signal: AbortSignal.timeout(15e3)
          });
          if (!res.ok) return null;
          return await res.text();
        } catch {
          return null;
        }
      })
    );
    const script = scripts.find((s) => s && /getSources/i.test(s) && /AES-CBC/i.test(s)) ?? null;
    if (script) this.cache.set(cacheKey, script, 86400);
    return script;
  }
  decryptMegaPlaySource(enc, script) {
    let encrypted;
    try {
      encrypted = Buffer.from(enc, "base64url");
    } catch {
      return null;
    }
    if (!encrypted.length || encrypted.length % 16 !== 0) return null;
    const tryPair = (keyValue, ivValue) => {
      try {
        const key = Buffer.alloc(32);
        Buffer.from(keyValue).copy(key);
        const decipher = (0, import_crypto.createDecipheriv)("aes-256-cbc", key, Buffer.from(ivValue));
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        const data = JSON.parse(decrypted.toString("utf8"));
        const source = data?.file ?? data?.url;
        return typeof source === "string" && source ? source : null;
      } catch {
        return null;
      }
    };
    const cachedPair = this.cache.get("megaplay_crypt_pair");
    if (cachedPair) {
      const hit = tryPair(cachedPair.keyValue, cachedPair.ivValue);
      if (hit) return hit;
    }
    const values = this.getScriptStrings(script).filter(
      (s) => Buffer.byteLength(s) > 0 && Buffer.byteLength(s) <= 32
    );
    const ivs = values.filter((s) => Buffer.byteLength(s) === 16);
    for (const keyValue of values) {
      for (const ivValue of ivs) {
        const hit = tryPair(keyValue, ivValue);
        if (hit) {
          this.cache.set("megaplay_crypt_pair", { keyValue, ivValue }, 86400);
          return hit;
        }
      }
    }
    return null;
  }
  async fetchMegaPlayData(fileId, pageUrl, clientScript) {
    const routes = clientScript ? this.getScriptStrings(clientScript).filter((v) => /^stream\/getSources[\w/-]*$/i.test(v)).sort((a, b) => a.length - b.length) : [];
    const legacy = routes[0] ?? "stream/getSources";
    const modern = routes.find((r) => r !== legacy && r.startsWith(legacy)) ?? null;
    const fetchRoute = async (route) => {
      if (!route) return null;
      try {
        const url = new URL(route, "https://megaplay.buzz/");
        url.searchParams.append("id", fileId);
        url.searchParams.append("id", fileId);
        const res = await fetch(url.href, {
          headers: {
            ...this.megaPlayHeaders,
            Referer: pageUrl,
            "X-Requested-With": "XMLHttpRequest"
          },
          signal: AbortSignal.timeout(15e3)
        });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };
    const [modernData, legacyData] = await Promise.all([fetchRoute(modern), fetchRoute(legacy)]);
    const data = modernData ?? legacyData;
    if (!data) return null;
    const directFile = (Array.isArray(data.sources) ? data.sources[0]?.file : data.sources?.file) ?? (Array.isArray(legacyData?.sources) ? legacyData.sources[0]?.file : legacyData?.sources?.file);
    if (directFile) {
      return {
        sources: { file: directFile },
        tracks: modernData?.tracks ?? legacyData?.tracks
      };
    }
    const enc = modernData && "enc" in modernData ? modernData.enc : legacyData?.enc;
    if (enc && clientScript) {
      const url = this.decryptMegaPlaySource(enc, clientScript);
      if (url) {
        return {
          sources: { file: url },
          tracks: modernData?.tracks ?? legacyData?.tracks
        };
      }
    }
    return data;
  }
  async getMalId(anilistId) {
    const cacheKey = `megaplay_malid_${anilistId}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== void 0) return cached || null;
    try {
      const gql = `query ($id: Int) {
        Media (id: $id, type: ANIME) {
          idMal
        }
      }`;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: gql,
          variables: { id: Number(anilistId) }
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) {
        this.cache.set(cacheKey, "", 3600);
        return null;
      }
      const data = await res.json();
      const idMal = data?.data?.Media?.idMal;
      if (!idMal) {
        this.cache.set(cacheKey, "", 3600);
        return null;
      }
      const result = String(idMal);
      this.cache.set(cacheKey, result, 86400);
      return result;
    } catch {
      return null;
    }
  }
  async tryFetchStream(showId, targetEpisode, mode, endpoint) {
    const base = this.megaPlayBase.replace("/ani", `/${endpoint}`);
    const streamPageUrl = `${base}/${showId}/${targetEpisode}/${mode}`;
    const pageRes = await fetch(streamPageUrl, {
      headers: this.megaPlayHeaders,
      signal: AbortSignal.timeout(15e3)
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const idMatch = html.match(/data-id="([0-9]+)"/);
    const extractedId = idMatch ? idMatch[1] : html.match(/<title>File ([0-9]+)/i)?.[1];
    if (!extractedId) return null;
    const clientScript = await this.getMegaPlayClientScript(streamPageUrl, html);
    const data = await this.fetchMegaPlayData(extractedId, streamPageUrl, clientScript);
    if (!data) return null;
    let sources = [];
    if (Array.isArray(data.sources)) {
      sources = data.sources;
    } else if (data.sources && "file" in data.sources) {
      sources = [data.sources];
    }
    if (sources.length === 0) return null;
    const links = [];
    for (const s of sources) {
      if (s.file.includes(".m3u8")) {
        try {
          const masterRes = await fetch(s.file, {
            headers: {
              Referer: "https://megaplay.buzz/",
              "User-Agent": this.megaPlayHeaders["User-Agent"]
            },
            signal: AbortSignal.timeout(1e4)
          });
          if (masterRes.ok) {
            const playlist = await masterRes.text();
            const variantRe = /#EXT-X-STREAM-INF:([^\n]*)\n(\S+)/g;
            let m;
            while ((m = variantRe.exec(playlist)) !== null) {
              const attrs = m[1];
              const label = attrs.match(/NAME="([^"]+)"/)?.[1] || (attrs.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? "") + "p" || "";
              if (!label || label === "p") continue;
              const variantUrl = new URL(m[2], s.file).href;
              links.push({
                resolutionStr: label,
                link: variantUrl,
                hls: true,
                headers: {
                  Referer: "https://megaplay.buzz/",
                  "User-Agent": this.megaPlayHeaders["User-Agent"]
                }
              });
            }
          }
        } catch {
        }
        links.push({
          resolutionStr: "Auto",
          link: s.file,
          hls: true,
          headers: {
            Referer: "https://megaplay.buzz/",
            "User-Agent": this.megaPlayHeaders["User-Agent"]
          }
        });
      } else {
        links.push({
          resolutionStr: "Auto",
          link: s.file,
          hls: false,
          headers: {
            Referer: "https://megaplay.buzz/",
            "User-Agent": this.megaPlayHeaders["User-Agent"]
          }
        });
      }
    }
    const subtitles = (data.tracks || []).filter((t) => {
      const kind = (t.kind || "").toLowerCase();
      return t.file && (!kind || kind.includes("caption") || kind.includes("sub"));
    }).map((t) => ({
      language: t.label || "Unknown",
      label: t.label || "Unknown",
      url: t.file
    }));
    return [
      {
        sourceName: `MegaPlay (${mode.toUpperCase()})`,
        links,
        subtitles,
        type: "player",
        actualEpisodeNumber: targetEpisode
      },
      {
        sourceName: `MegaPlay (${mode.toUpperCase()}) [Fallback]`,
        links: [
          {
            link: streamPageUrl,
            resolutionStr: "Auto",
            hls: false,
            headers: { Referer: "https://megaplay.buzz/" }
          }
        ],
        subtitles: [],
        type: "iframe",
        actualEpisodeNumber: targetEpisode
      }
    ];
  }
  async search(options) {
    if (!options.query) return [];
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: `query ($search: String) {
            Page(page: 1, perPage: 15) {
              media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                id
                title { romaji english native }
                coverImage { large }
                format
                episodes
              }
            }
          }`,
          variables: { search: options.query }
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) return [];
      const data = await res.json();
      const list = data?.data?.Page?.media || [];
      return list.map((m) => ({
        _id: String(m.id),
        id: String(m.id),
        anilistId: m.id,
        name: m.title?.english || m.title?.romaji || "Unknown",
        thumbnail: m.coverImage?.large,
        type: m.format,
        episodeCount: m.episodes
      }));
    } catch {
      return [];
    }
  }
  async resolveShowId(title, _romaji) {
    const results = await this.search({ query: title });
    return results[0]?._id || null;
  }
  async getEpisodes(showId) {
    const cacheKey = "episodes_" + showId;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id) { episodes description } }`,
          variables: { id: parseInt(showId, 10) }
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const count = data?.data?.Media?.episodes || 12;
      const episodes = Array.from({ length: count }, (_, i) => String(i + 1));
      const result = {
        episodes,
        description: data?.data?.Media?.description || ""
      };
      this.cache.set(cacheKey, result, 1800);
      return result;
    } catch {
      return null;
    }
  }
  async getStreamUrls(showId, episodeNumber, mode = "sub") {
    if (!/^\d+$/.test(showId)) return null;
    let targetEpisode = episodeNumber;
    if (episodeNumber === "0") {
      targetEpisode = "1";
    }
    try {
      const cacheKey = `megaplay_stream_${showId}_${targetEpisode}_${mode}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
      let result = await this.tryFetchStream(showId, targetEpisode, mode, "ani");
      if (!result) {
        const malId = await this.getMalId(showId);
        if (malId) {
          result = await this.tryFetchStream(malId, targetEpisode, mode, "mal");
        }
      }
      if (result) {
        this.cache.set(cacheKey, result, 3600);
      }
      return result;
    } catch {
      return null;
    }
  }
};
var index_default = new MegaPlayExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MegaPlayExtension,
  metadata
});
