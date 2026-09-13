import {
  AnimeExtension,
  ExtensionMetadata,
  Show,
  VideoSource,
  EpisodeDetails,
  SearchOptions,
  SimpleCache,
  pickBestMatch,
  buildQueryVariants,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'hn',
  name: 'HN',
  version: '1.0.1',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from HentaiNi',
}

const BASE_URL = 'https://hentaini.com'

export class HnExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
          Referer: BASE_URL + '/',
        },
        signal: AbortSignal.timeout(15000),
      })
      return res.ok ? await res.text() : null
    } catch {
      return null
    }
  }

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    const cacheKey = 'search_' + options.query
    const cached = this.cache.get<Show[]>(cacheKey)
    if (cached) return cached

    const html = await this.fetchHtml(`${BASE_URL}/explore?q=${encodeURIComponent(options.query)}`)
    if (!html) return []

    const results: Show[] = []
    const seen = new Set<string>()
    const matches = [...html.matchAll(/<a[^>]+href=['"]\/h\/([a-zA-Z0-9_-]+)['"][^>]*>([\s\S]*?)<\/a>/gi)]

    for (const m of matches) {
      const slug = m[1]
      if (seen.has(slug)) continue
      seen.add(slug)
      const inner = m[2]
      const titleMatch = inner.match(/<h[1-4][^>]*>([^<]+)<\/h[1-4]>/i) || inner.match(/class=['"][^'"]*title[^'"]*['"][^>]*>([^<]+)</i)
      const name = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ')
      const imgMatch = inner.match(/src=['"]([^'"]+)['"]/i)
      const thumb = imgMatch ? imgMatch[1] : ''

      results.push({
        _id: slug,
        id: slug,
        name,
        englishName: name,
        thumbnail: thumb,
        type: 'OVA',
        isAdult: true,
      })
    }

    this.cache.set(cacheKey, results, 1800)
    return results
  }

  async resolveShowId(title: string, romaji?: string): Promise<string | null> {
    const variants = buildQueryVariants(title, romaji)
    for (const q of variants) {
      try {
        const results = await this.search({ query: q })
        const match = pickBestMatch(
          results.map((r) => ({ title: r.name, id: r._id })),
          [title, romaji].filter((t): t is string => !!t)
        )
        if (match) return match.item.id || null
      } catch {}
    }
    return null
  }

  async getEpisodes(showId: string): Promise<EpisodeDetails | null> {
    const cleanId = showId.replace(/^\/+|\/+$/g, '').replace(/^h\//, '')
    const html = await this.fetchHtml(`${BASE_URL}/h/${cleanId}`)
    if (!html) return null

    const episodes: string[] = []
    const re = new RegExp(`/h/${cleanId}/(\\d+)`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const epNum = m[1]
      if (!episodes.includes(epNum)) episodes.push(epNum)
    }

    return {
      episodes: episodes.length ? episodes : ['1'],
      description: '',
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    const cleanId = showId.replace(/^\/+|\/+$/g, '').replace(/^h\//, '')
    const html = await this.fetchHtml(`${BASE_URL}/h/${cleanId}/${episodeNumber}`)
    if (!html) return []

    const sources: VideoSource[] = []
    const m3u8Matches = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g)].map((m) => m[0].replace(/\\+$/, ''))
    const uniqueM3u8 = [...new Set(m3u8Matches)]
    if (uniqueM3u8.length > 0) {
      sources.push({
        sourceName: 'HN Stream (HLS)',
        links: uniqueM3u8.map((l) => ({ resolutionStr: 'Auto', link: l, hls: true })),
        type: 'player',
      })
    }

    const embedMatches = [...html.matchAll(/https?:\/\/(?:streamwish\.[a-z]+|mp4upload\.com)\/[e\/embed-]+[a-zA-Z0-9_-]+/g)].map((m) => m[0].replace(/\\+$/, ''))
    const uniqueEmbeds = [...new Set(embedMatches)]
    for (const em of uniqueEmbeds) {
      sources.push({
        sourceName: 'HN Embed',
        links: [],
        type: 'iframe',
        iframeUrl: em,
      })
    }

    return sources
  }
}

export default new HnExtension()
