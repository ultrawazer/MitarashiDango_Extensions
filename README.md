# MitarashiDango Extensions

Official repository of modular scrapers and content provider extensions for [MitarashiDango](https://github.com/ultrawazer/MitarashiDango).

Inspired by Mihon/Tachiyomi extensions, each extension is an isolated scraper module that communicates with MitarashiDango through the @dango/extension-core SDK interface.


## Development & Building

1. Install dependencies: npm install
   

2. Build all extensions: npm run build
   

Compiled bundles will be generated into \dist/<id>.js\ along with the repository manifest at \dist/index.min.json\.
