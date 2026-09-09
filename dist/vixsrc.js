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

// extensions/vixsrc/index.ts
var index_exports = {};
__export(index_exports, {
  VixSrcExtension: () => VixSrcExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var metadata = {
  id: "vixsrc",
  name: "VixSrc (HLS)",
  version: "1.0.0",
  type: "tv",
  lang: "en",
  mature: false,
  description: "Direct HLS streams and multi-language subtitles from VixSrc"
};
var BASE_URL = "https://vixsrc.to";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 Chrome/150 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  Referer: BASE_URL,
  Origin: BASE_URL
};
var VixSrcExtension = class {
  metadata = metadata;
  async getStreamUrls(options) {
    try {
      const pageUrl = options.mediaType === "movie" ? `${BASE_URL}/api/movie/${options.tmdbId}` : `${BASE_URL}/api/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`;
      const apiRes = await fetch(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(1e4) });
      if (!apiRes.ok) return { sources: [], error: "VixSrc API error" };
      const apiData = await apiRes.json();
      if (!apiData?.src) return { sources: [] };
      const htmlUrl = BASE_URL + apiData.src;
      const htmlRes = await fetch(htmlUrl, { headers: { ...HEADERS, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(1e4) });
      if (!htmlRes.ok) return { sources: [] };
      const html = await htmlRes.text();
      const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
      const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
      const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1];
      if (!token || !expires || !playlist) return { sources: [] };
      const sep = playlist.includes("?") ? "&" : "?";
      const masterUrl = `${playlist}${sep}token=${token}&expires=${expires}&h=1`;
      return {
        sources: [
          {
            sourceName: "VixSrc Master HLS",
            links: [
              {
                resolutionStr: "Auto",
                link: masterUrl,
                hls: true,
                headers: { Referer: pageUrl }
              }
            ],
            type: "player"
          }
        ]
      };
    } catch (e) {
      return { sources: [], error: e.message };
    }
  }
};
var index_default = new VixSrcExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VixSrcExtension,
  metadata
});
