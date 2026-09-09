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

// extensions/vidfast/index.ts
var index_exports = {};
__export(index_exports, {
  VidFastExtension: () => VidFastExtension,
  default: () => index_default,
  metadata: () => metadata
});
module.exports = __toCommonJS(index_exports);
var metadata = {
  id: "vidfast",
  name: "VidFast",
  version: "1.0.0",
  type: "tv",
  lang: "en",
  mature: false,
  description: "VidFast streaming player embed"
};
var VidFastExtension = class {
  metadata = metadata;
  async getStreamUrls(options) {
    const iframeUrl = options.mediaType === "movie" ? `https://vidfast.pro/movie/${options.tmdbId}` : `https://vidfast.pro/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`;
    return {
      iframeUrl,
      sources: [
        {
          sourceName: "VidFast",
          links: [],
          type: "iframe",
          iframeUrl
        }
      ]
    };
  }
};
var index_default = new VidFastExtension();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VidFastExtension,
  metadata
});
