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
  id: 'ht',
  name: 'HT',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from HentaiTV',
}

const BASE_URL = 'https://hentai.tv'
const API_URL = 'https://hentai.tv/api/search'

export class HtExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    try {
      const res = await fetch(`${API_URL}?q=${encodeURIComponent(options.query)}&limit=40`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const videos = data?.videos || []

      const seriesMap = new Map<string, any>()
      for (const v of videos) {
        const s = v.titleSlug || v.slug
        if (!seriesMap.has(s)) seriesMap.set(s, v)
      }

      return Array.from(seriesMap.values()).map((v) => ({
        _id: v.titleSlug || v.slug,
        id: v.titleSlug || v.slug,
        name: v.title,
        englishName: v.title,
        thumbnail: v.cover || v.thumb,
        type: 'OVA',
        isAdult: true,
      }))
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
    try {
      const res = await fetch(`${API_URL}?q=${encodeURIComponent(showId)}&limit=50`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const videos = data?.videos || []
      const eps = videos.map((v: any) => String(v.ep || 1))

      return {
        episodes: eps.length ? eps : ['1'],
        description: videos[0]?.description || '',
      }
    } catch {
      return null
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    try {
      const res = await fetch(`${API_URL}?q=${encodeURIComponent(showId)}&limit=50`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const video = (data?.videos || []).find((v: any) => String(v.ep) === episodeNumber) || data?.videos?.[0]
      if (!video?.embedUrl) return []

      return [
        {
          sourceName: 'HT Embed',
          links: [],
          type: 'iframe',
          iframeUrl: video.embedUrl,
        },
      ]
    } catch {
      return []
    }
  }
}

export default new HtExtension()
