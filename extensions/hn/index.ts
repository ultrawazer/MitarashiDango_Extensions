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
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from HentaiNi',
}

const BASE_URL = 'https://hentaini.com'
const API_URL = 'https://admin.hentaini.com/api'

export class HnExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(options.query)}`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.data || []

      return list.map((item: any) => ({
        _id: String(item.id || item.slug),
        id: String(item.id || item.slug),
        name: item.title || item.name || '',
        englishName: item.title,
        thumbnail: item.poster || item.image ? `https://admin.hentaini.com/uploads/${item.poster || item.image}` : '',
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
      const res = await fetch(`${API_URL}/series/${showId}`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const eps = data?.episodes || []
      return {
        episodes: eps.map((e: any) => String(e.episode_number || e.number || '1')),
        description: data?.description || '',
      }
    } catch {
      return null
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    try {
      const res = await fetch(`${API_URL}/series/${showId}/episode/${episodeNumber}`, {
        headers: { Referer: BASE_URL + '/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const players = data?.players || []

      return players.map((p: any) => ({
        sourceName: `HN (${p.server || 'Server'})`,
        links: [{ resolutionStr: 'Auto', link: p.url, hls: p.url.includes('.m3u8') }],
        type: 'player',
      }))
    } catch {
      return []
    }
  }
}

export default new HnExtension()
