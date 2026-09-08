const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const EXT_ROOT = path.resolve(__dirname, '..')
const EXT_DIR = path.join(EXT_ROOT, 'extensions')
const DIST_DIR = path.join(EXT_ROOT, 'dist')

if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })

if (!fs.existsSync(EXT_DIR)) {
  console.log('No extensions directory found at ' + EXT_DIR)
  process.exit(0)
}

const entries = fs.readdirSync(EXT_DIR, { withFileTypes: true })
const extensionDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)

console.log(`Found ${extensionDirs.length} extension(s): ${extensionDirs.join(', ')}`)

const manifestList = []

for (const extId of extensionDirs) {
  const extPath = path.join(EXT_DIR, extId)
  const entryPoint = ['index.ts', 'index.js', 'src/index.ts'].map((f) => path.join(extPath, f)).find(fs.existsSync)
  
  if (!entryPoint) {
    console.warn(`Skipping ${extId}: no index.ts / index.js found`)
    continue
  }

  const outFile = path.join(DIST_DIR, `${extId}.js`)
  console.log(`Building ${extId} -> dist/${extId}.js ...`)

  try {
    esbuild.buildSync({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      outfile: outFile,
      sourcemap: false,
      minify: false,
      external: ['got-scraping'], // got-scraping has json assets read via __dirname; keep external so host resolves it
    })

    // Load compiled module to extract metadata
    delete require.cache[require.resolve(outFile)]
    const mod = require(outFile)
    const instance = mod.default || mod
    const metadata = instance.metadata || mod.metadata

    if (metadata) {
      manifestList.push({
        ...metadata,
        pkg: `${extId}.js`,
        size: fs.statSync(outFile).size,
        updatedAt: new Date().toISOString()
      })
      console.log(`  ✓ ${metadata.name} v${metadata.version} (${metadata.type})`)
    } else {
      console.warn(`  ⚠ ${extId} built but exported no metadata!`)
    }
  } catch (err) {
    console.error(`Failed to build ${extId}:`, err)
  }
}

// Generate index.min.json
const manifestPath = path.join(DIST_DIR, 'index.min.json')
fs.writeFileSync(manifestPath, JSON.stringify(manifestList, null, 2))
console.log(`\nGenerated repository manifest at ${manifestPath} with ${manifestList.length} extensions.`)
