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
  version: "1.0.0",
  type: "anime",
  lang: "en",
  mature: false,
  description: "Direct HLS anime streams from MegaPlay"
};
var MegaPlayExtension = class {
  metadata = metadata;
  megaPlayBase = "https://megaplay.buzz/stream/ani";
  cache = new SimpleCache();
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
  async getStreamUrls(showId, episodeNumber) {
    try {
      const res = await fetch(`${this.megaPlayBase}/${showId}/${episodeNumber}`, {
        headers: { Referer: "https://megaplay.buzz/" },
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) return [];
      const data = await res.json();
      const streamUrl = data?.stream || data?.url || data?.link;
      if (!streamUrl) return [];
      return [
        {
          sourceName: "MegaPlay HLS",
          links: [
            {
              resolutionStr: "Auto",
              link: streamUrl,
              hls: true,
              headers: { Referer: "https://megaplay.buzz/" }
            }
          ],
          type: "player"
        }
      ];
    } catch {
      return [];
    }
  }
};
var index_default = new MegaPlayExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MegaPlayExtension,
  metadata
});
