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
  id: 'op',
  name: 'OP',
  version: '1.0.1',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from OppaiStream',
}

const BASE_URL = 'https://oppai.stream'

export class OpExtension implements AnimeExtension {
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

    try {
      const res = await fetch(`${BASE_URL}/actions/search.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: BASE_URL + '/',
          'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        },
        body: `q=${encodeURIComponent(options.query)}`,
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return []
      const html = await res.text()

      const entries: Show[] = []
      const re = /<div\s+class=['"][^'"]*episode-shown[^'"]*['"][^>]*folder=['"]([^'"]+)['"][^>]*ep=['"]([^'"]*)['"][^>]*name=['"]([^'"]+)['"][^>]*desc=['"]([^'"]*)['"][^>]*href=['"]([^'"]+)['"]/gi
      let m: RegExpExecArray | null
      const seen = new Set<string>()

      while ((m = re.exec(html)) !== null) {
        const folder = m[1]
        const ep = m[2] || '1'
        const name = m[3]
        const href = m[5]

        if (!seen.has(folder)) {
          seen.add(folder)
          entries.push({
            _id: folder,
            id: folder,
            name,
            englishName: name,
            type: 'OVA',
            isAdult: true,
          })
        }
        const epKey = `ep_${folder}_${ep}`
        this.cache.set(epKey, href, 3600)
      }
      this.cache.set(cacheKey, entries, 1800)
      return entries
    } catch {
      return []
    }
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
    const eps: string[] = []
    for (let i = 1; i <= 24; i++) {
      if (this.cache.get(`ep_${showId}_${i}`)) {
        eps.push(String(i))
      }
    }
    return {
      episodes: eps.length ? eps : ['1'],
      description: '',
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    let watchUrl = this.cache.get<string>(`ep_${showId}_${episodeNumber}`)
    if (!watchUrl) {
      await this.search({ query: showId })
      watchUrl = this.cache.get<string>(`ep_${showId}_${episodeNumber}`)
    }
    if (!watchUrl) return []

    const html = await this.fetchHtml(watchUrl)
    if (!html) return []

    const sources: VideoSource[] = []
    const m = html.match(/<source[^>]*src=['"]([^'"]+)['"]/i) || html.match(/<video[^>]*src=['"]([^'"]+)['"]/i)
    if (m && m[1]) {
      sources.push({
        sourceName: 'OP Stream',
        links: [{ resolutionStr: '720p', link: m[1], hls: m[1].includes('.m3u8') }],
        type: 'player',
      })
    }

    return sources
  }
}

export default new OpExtension()
