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

// extensions/movybz/index.ts
var index_exports = {};
__export(index_exports, {
  MovyBzExtension: () => MovyBzExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var metadata = {
  id: "movybz",
  name: "Movy.bz (4K HLS)",
  version: "1.0.0",
  type: "tv",
  lang: "en",
  mature: false,
  description: "Multi-server 4K HLS streaming for movies and TV series"
};
var MOVY_API = "https://api.wecollege.net";
var MOVY_SERVERS = [
  "miami",
  "phoenix",
  "dallas",
  "seattle",
  "denver",
  "cancun",
  "atlanta",
  "houston",
  "portland",
  "austin",
  "munich",
  "berlin",
  "paris",
  "delhi"
];
var MOVY_K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580
];
var MOVY_MAGIC = [109, 118, 109, 49];
function movyMix(e) {
  e >>>= 0;
  e ^= e >>> 16;
  e = Math.imul(e, 2246822507) >>> 0;
  e ^= e >>> 13;
  e = Math.imul(e, 3266489909) >>> 0;
  e ^= e >>> 16;
  return e >>> 0;
}
function movyShift(e, t) {
  return e >>>= 0, 0 === (t &= 31) ? e >>> 0 : (e << t | e >>> 32 - t) >>> 0;
}
function decodeMovyPayload(e, t, a) {
  const r = (function(e2) {
    const t2 = e2.replace(/-/g, "+").replace(/_/g, "/").padEnd(4 * Math.ceil(e2.length / 4), "=");
    return new Uint8Array(Buffer.from(t2, "base64"));
  })(e);
  const n = (function(e2, t2, a2) {
    const s = (function(e3, t3) {
      const s2 = Array(61);
      let r3 = movyMix(
        (function(e4) {
          let t4 = 2166136261;
          for (let a3 = 0; a3 < e4.length; a3++) t4 = Math.imul(t4 ^ e4.charCodeAt(a3), 16777619) >>> 0;
          return movyMix(t4);
        })(e3) ^ movyMix(t3 >>> 0 ^ 2654435769)
      ) >>> 0;
      for (let e4 = 0; e4 < 8; e4++) {
        if ((r3 * (r3 + 1) & 1) === 0) {
          const t4 = r3 % 61;
          r3 = movyShift(r3 + 2654435769 >>> 0, 7 + (7 & e4));
          s2[t4] = (r3 ^ movyMix(r3)) >>> 0;
          r3 = movyMix(r3 + t4 >>> 0);
        } else {
          s2[e4] = MOVY_K[15 & e4];
        }
      }
      return { S: s2, acc: movyMix(2779096485 ^ r3) >>> 0 };
    })(e2, t2);
    const r2 = new Uint8Array(a2);
    let n2 = 0;
    for (let e3 = 0; e3 < a2; ) {
      const t3 = (function(e4, t4) {
        const r3 = e4.S;
        let n3 = e4.acc;
        const i = n3 % 61;
        const o = 0 - Number(i in r3);
        const l = r3[i] >>> 0;
        const c = Math.imul(2654435769, t4 + 1) >>> 0;
        const h = ((n3 ^ (l ^ c) >>> 0) >>> 0 | n3 & (l ^ c) >>> 0 & o) >>> 0 >>> 0;
        n3 = movyMix((movyShift(h + n3 >>> 0, 31 & i) ^ movyShift(n3, 31 & Math.imul(i, 7))) + 2654435769 >>> 0);
        r3[i] = n3 >>> 0;
        e4.acc = n3;
        return n3 >>> 0;
      })(s, n2++);
      r2[e3++] = 255 & t3;
      if (e3 < a2) r2[e3++] = t3 >>> 8 & 255;
      if (e3 < a2) r2[e3++] = t3 >>> 16 & 255;
      if (e3 < a2) r2[e3++] = t3 >>> 24 & 255;
    }
    return r2;
  })(String(t), a, r.length);
  for (let e2 = 0; e2 < r.length; e2++) r[e2] ^= n[e2];
  for (let e2 = 0; e2 < MOVY_MAGIC.length; e2++) {
    if (r[e2] !== MOVY_MAGIC[e2]) throw new Error("decrypt failed: bad seed or payload");
  }
  return Buffer.from(r.subarray(MOVY_MAGIC.length)).toString("utf8");
}
async function movyGetSeed(mediaId) {
  try {
    const r = await fetch(`${MOVY_API}/seed?mediaId=${mediaId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
        Referer: "https://www.movy.bz/",
        Origin: "https://www.movy.bz"
      },
      signal: AbortSignal.timeout(5e3)
    });
    if (r.ok) {
      const data = await r.json();
      return data.seed;
    }
    return null;
  } catch {
    return null;
  }
}
var MovyBzExtension = class {
  metadata = metadata;
  async getStreamUrls(options) {
    const seed = await movyGetSeed(options.tmdbId);
    if (!seed) return { sources: [], error: "Seed unavailable" };
    const baseParams = {
      title: options.title || "",
      mediaType: options.mediaType,
      year: options.year || "",
      tmdbId: String(options.tmdbId),
      imdbId: options.imdbId || "",
      enc: "2",
      seed
    };
    if (options.mediaType === "tv") {
      baseParams.totalSeasons = String(options.totalSeasons || "1");
      baseParams.seasonId = String(options.season || "1");
      baseParams.episodeId = String(options.episode || "1");
    }
    const headers = {
      "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
      Referer: "https://www.movy.bz/",
      Origin: "https://www.movy.bz"
    };
    const serversToTry = options.server ? [options.server] : MOVY_SERVERS;
    for (const city of serversToTry) {
      try {
        const params = new URLSearchParams({ ...baseParams, seed });
        const r = await fetch(`${MOVY_API}/${city}/sources?${params.toString()}`, {
          headers,
          signal: AbortSignal.timeout(5e3)
        });
        if (!r.ok) continue;
        const encrypted = await r.text();
        const decrypted = decodeMovyPayload(encrypted, seed, options.tmdbId);
        const data = JSON.parse(decrypted);
        if (!Array.isArray(data.sources) || data.sources.length === 0) continue;
        const sources = [];
        const audioTracks = [];
        for (const s of data.sources) {
          if (!s.url || s.url.includes(".mpd")) continue;
          sources.push({
            sourceName: `Movy ${city.toUpperCase()} (${s.quality || "Auto"})`,
            links: [
              {
                resolutionStr: s.quality || "Auto",
                link: s.url,
                hls: s.url.includes(".m3u8"),
                headers: { Referer: "https://www.movy.bz/" }
              }
            ],
            type: "player"
          });
        }
        if (sources.length > 0) {
          return { server: city, sources, audioTracks };
        }
      } catch {
      }
    }
    return { sources: [], error: "No sources found from Movy servers" };
  }
};
var index_default = new MovyBzExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MovyBzExtension,
  metadata
});
