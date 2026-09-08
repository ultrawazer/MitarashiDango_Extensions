import {
  TvExtension,
  ExtensionMetadata,
  TvStreamOptions,
  TvStreamResult,
  VideoSource,
  AudioTrack,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'movybz',
  name: 'Movy.bz (4K HLS)',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'Multi-server 4K HLS streaming for movies and TV series',
}

const MOVY_API = 'https://api.wecollege.net'
const MOVY_SERVERS = [
  'miami', 'phoenix', 'dallas', 'seattle', 'denver', 'cancun', 'atlanta',
  'houston', 'portland', 'austin', 'munich', 'berlin', 'paris', 'delhi'
]
const MOVY_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
]
const MOVY_MAGIC = [109, 118, 109, 49]

function movyMix(e: number): number {
  e >>>= 0
  e ^= e >>> 16
  e = Math.imul(e, 0x85ebca6b) >>> 0
  e ^= e >>> 13
  e = Math.imul(e, 0xc2b2ae35) >>> 0
  e ^= e >>> 16
  return e >>> 0
}

function movyShift(e: number, t: number): number {
  return (e >>>= 0), 0 === (t &= 31) ? e >>> 0 : ((e << t) | (e >>> (32 - t))) >>> 0
}

function decodeMovyPayload(e: string, t: string | number, a: number): string {
  const r = (function (e: string) {
    const t = e.replace(/-/g, '+').replace(/_/g, '/').padEnd(4 * Math.ceil(e.length / 4), '=')
    return new Uint8Array(Buffer.from(t, 'base64'))
  })(e)

  const n = (function (e: string, t: string | number, a: number) {
    const s = (function (e: string, t: string | number) {
      const s = Array(61)
      let r = movyMix(
        (function (e: string) {
          let t = 0x811c9dc5
          for (let a = 0; a < e.length; a++) t = Math.imul(t ^ e.charCodeAt(a), 0x1000193) >>> 0
          return movyMix(t)
        })(e) ^ movyMix(((t as number) >>> 0) ^ 0x9e3779b9)
      ) >>> 0
      for (let e = 0; e < 8; e++) {
        if (((r * (r + 1)) & 1) === 0) {
          const t = r % 61
          r = movyShift((r + 0x9e3779b9) >>> 0, 7 + (7 & e))
          s[t] = (r ^ movyMix(r)) >>> 0
          r = movyMix((r + t) >>> 0)
        } else {
          s[e] = MOVY_K[15 & e]
        }
      }
      return { S: s, acc: movyMix(0xa5a5a5a5 ^ r) >>> 0 }
    })(e, t)
    const r = new Uint8Array(a)
    let n = 0
    for (let e = 0; e < a;) {
      const t = (function (e: { S: number[]; acc: number }, t: number) {
        const r = e.S
        let n = e.acc
        const i = n % 61
        const o = 0 - Number(i in r)
        const l = r[i] >>> 0
        const c = Math.imul(0x9e3779b9, t + 1) >>> 0
        const h = ((((n ^ ((l ^ c) >>> 0)) >>> 0) | (n & ((l ^ c) >>> 0) & o)) >>> 0) >>> 0
        n = movyMix(((movyShift((h + n) >>> 0, 31 & i) ^ movyShift(n, 31 & Math.imul(i, 7))) + 0x9e3779b9) >>> 0)
        r[i] = n >>> 0
        e.acc = n
        return n >>> 0
      })(s, n++)
      r[e++] = 255 & t
      if (e < a) r[e++] = (t >>> 8) & 255
      if (e < a) r[e++] = (t >>> 16) & 255
      if (e < a) r[e++] = (t >>> 24) & 255
    }
    return r
  })(String(t), a, r.length)

  for (let e = 0; e < r.length; e++) r[e] ^= n[e]
  for (let e = 0; e < MOVY_MAGIC.length; e++) {
    if (r[e] !== MOVY_MAGIC[e]) throw new Error('decrypt failed: bad seed or payload')
  }
  return Buffer.from(r.subarray(MOVY_MAGIC.length)).toString('utf8')
}

async function movyGetSeed(mediaId: number): Promise<string | null> {
  try {
    const r = await fetch(`${MOVY_API}/seed?mediaId=${mediaId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        Referer: 'https://www.movy.bz/',
        Origin: 'https://www.movy.bz',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (r.ok) {
      const data = await r.json()
      return data.seed
    }
    return null
  } catch {
    return null
  }
}

export class MovyBzExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    const seed = await movyGetSeed(options.tmdbId)
    if (!seed) return { sources: [], error: 'Seed unavailable' }

    const baseParams: Record<string, string> = {
      title: options.title || '',
      mediaType: options.mediaType,
      year: options.year || '',
      tmdbId: String(options.tmdbId),
      imdbId: options.imdbId || '',
      enc: '2',
      seed,
    }

    if (options.mediaType === 'tv') {
      baseParams.totalSeasons = String(options.totalSeasons || '1')
      baseParams.seasonId = String(options.season || '1')
      baseParams.episodeId = String(options.episode || '1')
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
      Referer: 'https://www.movy.bz/',
      Origin: 'https://www.movy.bz',
    }

    const serversToTry = options.server ? [options.server] : MOVY_SERVERS

    for (const city of serversToTry) {
      try {
        const params = new URLSearchParams({ ...baseParams, seed })
        const r = await fetch(`${MOVY_API}/${city}/sources?${params.toString()}`, {
          headers,
          signal: AbortSignal.timeout(5000),
        })
        if (!r.ok) continue
        const encrypted = await r.text()
        const decrypted = decodeMovyPayload(encrypted, seed, options.tmdbId)
        const data = JSON.parse(decrypted)

        if (!Array.isArray(data.sources) || data.sources.length === 0) continue

        const sources: VideoSource[] = []
        const audioTracks: AudioTrack[] = []

        for (const s of data.sources) {
          if (!s.url || s.url.includes('.mpd')) continue
          sources.push({
            sourceName: `Movy ${city.toUpperCase()} (${s.quality || 'Auto'})`,
            links: [
              {
                resolutionStr: s.quality || 'Auto',
                link: s.url,
                hls: s.url.includes('.m3u8'),
                headers: { Referer: 'https://www.movy.bz/' },
              },
            ],
            type: 'player',
          })
        }

        if (sources.length > 0) {
          return { server: city, sources, audioTracks }
        }
      } catch {}
    }

    return { sources: [], error: 'No sources found from Movy servers' }
  }
}

export default new MovyBzExtension()
