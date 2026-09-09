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

// extensions/anidb/index.ts
var index_exports = {};
__export(index_exports, {
  AniDBExtension: () => AniDBExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var import_got_scraping = require("got-scraping");

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

// extensions/anidb/index.ts
var metadata = {
  id: "anidb",
  name: "AniDB (anidb.app)",
  version: "1.0.0",
  type: "anime",
  lang: "en",
  mature: false,
  description: "Anime streams from anidb.app"
};
var BASE = "https://anidb.app";
var AniDBExtension = class {
  metadata = metadata;
  cache = new SimpleCache();
  async search(options) {
    if (!options.query) return [];
    try {
      const resp = await (0, import_got_scraping.gotScraping)({
        url: `${BASE}/browse?q=${encodeURIComponent(options.query)}`,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0" },
        responseType: "text"
      });
      if (resp.statusCode !== 200) return [];
      const entries = [];
      const regex = /<a href="[^"]*?anime\/([a-z0-9-]+)-([0-9]+)"[^>]*>[\s\S]*?<img src="([^"]*)" alt="([^"]*)"/g;
      let match;
      while ((match = regex.exec(resp.body)) !== null) {
        entries.push({
          _id: match[2],
          id: match[2],
          name: match[4],
          englishName: match[4],
          thumbnail: match[3],
          type: "TV"
        });
      }
      return entries;
    } catch {
      return [];
    }
  }
  async getEpisodes(showId) {
    try {
      const resp = await (0, import_got_scraping.gotScraping)({
        url: `${BASE}/api/frontend/anime/${showId}/episodes`,
        method: "GET",
        headers: { Accept: "application/json" },
        responseType: "text"
      });
      if (resp.statusCode !== 200) return null;
      const parsed = JSON.parse(resp.body);
      const list = parsed?.episodes || [];
      return {
        episodes: list.map((e) => String(e.number || e.id)),
        description: ""
      };
    } catch {
      return null;
    }
  }
  async getStreamUrls(showId, episodeNumber) {
    return [];
  }
};
var index_default = new AniDBExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AniDBExtension,
  metadata
});
