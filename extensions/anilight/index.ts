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
import { execFileSync } from 'node:child_process'

export const metadata: ExtensionMetadata = {
  id: 'anilight',
  name: 'Anilight',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: 'Fast HLS anime streams from Anilight',
}

const API_BASE = 'https://api.anilight.live/api'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'

function curlGet<T>(url: string): T | null {
  try {
    const args = [
      '-sSL',
      '-A', BROWSER_UA,
      '-H', 'Referer: https://anilight.live/',
      '-H', 'Origin: https://anilight.live',
      '-H', 'Accept: application/json,text/plain,*/*',
      '--max-time', '15',
      url,
    ]
    const out = execFileSync('curl', args, { encoding: 'utf-8' })
    return JSON.parse(out) as T
  } catch {
    return null
  }
}

export class AnilightExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    const cacheKey = 'search_' + options.query
    const cached = this.cache.get<Show[]>(cacheKey)
    if (cached) return cached

    const data = curlGet<any>(`${API_BASE}/search?query=${encodeURIComponent(options.query)}`)
    const list = data?.data || (Array.isArray(data) ? data : [])

    const results: Show[] = list.map((item: any) => ({
      _id: String(item.id || item.slug),
      id: String(item.id || item.slug),
      name: item.title || item.name || '',
      englishName: item.englishTitle || item.title,
      thumbnail: item.poster || item.image || item.cover,
      type: item.format || 'TV',
    }))

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
    const cacheKey = 'episodes_' + showId
    const cached = this.cache.get<EpisodeDetails>(cacheKey)
    if (cached) return cached

    const data = curlGet<any>(`${API_BASE}/anime/${encodeURIComponent(showId)}/episodes`)
    const list = data?.data || (Array.isArray(data) ? data : [])

    const episodes: string[] = list.map((ep: any) => String(ep.episodeNumber || ep.number || ep))
    const result: EpisodeDetails = { episodes, description: '' }
    this.cache.set(cacheKey, result, 1800)
    return result
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    const data = curlGet<any>(`${API_BASE}/anime/${encodeURIComponent(showId)}/episode/${episodeNumber}/sources`)
    const sourcesList = data?.data || (Array.isArray(data) ? data : [])

    const out: VideoSource[] = []
    for (const s of sourcesList) {
      const url = s.url || s.streamUrl
      if (url) {
        out.push({
          sourceName: `Anilight (${s.quality || 'Auto'})`,
          links: [
            {
              resolutionStr: s.quality || 'Auto',
              link: url,
              hls: url.includes('.m3u8'),
            },
          ],
          type: 'player',
        })
      }
    }
    return out
  }
}

export default new AnilightExtension()
