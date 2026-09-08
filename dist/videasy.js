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

// ../MitarashiDango_Extensions/extensions/videasy/index.ts
var index_exports = {};
__export(index_exports, {
  VidEasyExtension: () => VidEasyExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var metadata = {
  id: "videasy",
  name: "VidEasy",
  version: "1.0.0",
  type: "tv",
  lang: "en",
  mature: false,
  description: "VidEasy streaming player embed with overlay controls"
};
var VidEasyExtension = class {
  metadata = metadata;
  async getStreamUrls(options) {
    const iframeUrl = options.mediaType === "movie" ? `https://player.videasy.to/movie/${options.tmdbId}?overlay=true` : `https://player.videasy.to/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}?episodeSelector=true&overlay=true`;
    return {
      iframeUrl,
      sources: [
        {
          sourceName: "VidEasy",
          links: [],
          type: "iframe",
          iframeUrl
        }
      ]
    };
  }
};
var index_default = new VidEasyExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VidEasyExtension,
  metadata
});
