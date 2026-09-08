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
  id: '123anime',
  name: '123Anime',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: '123Anime scraper via Shirayuki proxy',
}

const BASE_URL = 'https://shirayuki-scrapper-api.onrender.com'

export class Anime123Extension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    const cacheKey = 'search_' + options.query
    const cached = this.cache.get<Show[]>(cacheKey)
    if (cached) return cached

    try {
      const res = await fetch(`${BASE_URL}/api/search/${encodeURIComponent(options.query)}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.results || []

      const results: Show[] = list.map((item: any) => ({
        _id: item.id || item.slug,
        id: item.id || item.slug,
        name: item.title || item.name || '',
        englishName: item.title,
        thumbnail: item.thumbnail || item.poster || item.image,
        type: item.type || 'TV',
      }))

      this.cache.set(cacheKey, results, 1800)
      return results
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
    const cacheKey = 'episodes_' + showId
    const cached = this.cache.get<EpisodeDetails>(cacheKey)
    if (cached) return cached

    try {
      const res = await fetch(`${BASE_URL}/api/episodes/${encodeURIComponent(showId)}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const rawList = Array.isArray(data) ? data : data?.episodes || []

      const episodes: string[] = rawList.map((e: any) => String(e.number || e.episode || e))
      const result: EpisodeDetails = { episodes, description: '' }
      this.cache.set(cacheKey, result, 1800)
      return result
    } catch {
      return null
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/stream/${encodeURIComponent(showId)}/${episodeNumber}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const link = data?.data?.streaming_link || data?.streaming_link || data?.stream || data?.url

      if (!link) return []
      return [
        {
          sourceName: '123Anime Stream',
          links: [
            {
              resolutionStr: 'Auto',
              link,
              hls: link.includes('.m3u8'),
            },
          ],
          type: 'player',
        },
      ]
    } catch {
      return []
    }
  }
}

export default new Anime123Extension()
