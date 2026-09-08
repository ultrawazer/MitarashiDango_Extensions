# MitarashiDango Extensions

Official repository of modular scrapers and content provider extensions for [MitarashiDango](https://github.com/ultrawazer/MitarashiDango).

Inspired by Mihon/Tachiyomi extensions, each extension is an isolated scraper module that communicates with MitarashiDango through the @dango/extension-core SDK interface.

## Available Extensions

### Anime
- **AnimePahe** (\nimepahe\): Fast HD anime streams with multi-quality and sub/dub support.
- **Animeya** (\nimeya\): Comprehensive anime stream indexing.
- **123Anime** (\123anime\): High-speed streaming source.
- **Anilight** (\nilight\): Minimalist anime scraper.
- **MegaPlay** (\megaplay\): Alternative anime streaming provider.
- **AniDB** (\nidb\): Direct search and metadata provider from anidb.app.

### TV Shows & Movies
- **Movy.bz** (\movybz\): 4K HLS streaming provider for movies and TV.
- **VixSrc** (\ixsrc\): Direct HLS stream extraction.
- **EmbedMaster** (\embedmaster\): Universal embed provider.
- **VidFast** (\idfast\): Fast video server embed.
- **VidEasy** (\ideasy\): Reliable movie and show streams.
- **VidRock** (\idrock\): Rock-solid embed provider.

### Mature / 18+ Anime
- **WH** (\wh\): Mature content provider.
- **HN** (\hn\): Mature content provider.
- **HT** (\ht\): Mature content provider.
- **OP** (\op\): Mature content provider.

### ASMR
- **Japanese ASMR** (\jasmr\): High-quality ASMR audio and voice drama tracks.

## Development & Building

1. Install dependencies:
   \\\ash
   npm install
   \\\

2. Build all extensions:
   \\\ash
   npm run build
   \\\

Compiled bundles will be generated into \dist/<id>.js\ along with the repository manifest at \dist/index.min.json\.
