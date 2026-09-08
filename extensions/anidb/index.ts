import { gotScraping } from 'got-scraping'
import {
  AnimeExtension,
  ExtensionMetadata,
  Show,
  VideoSource,
  EpisodeDetails,
  SearchOptions,
  SimpleCache,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'anidb',
  name: 'AniDB (anidb.app)',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: 'Anime streams from anidb.app',
}

const BASE = 'https://anidb.app'

export class AniDBExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    try {
      const resp = await gotScraping({
        url: `${BASE}/browse?q=${encodeURIComponent(options.query)}`,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124.0.0.0' },
        responseType: 'text',
      })
      if (resp.statusCode !== 200) return []

      const entries: Show[] = []
      const regex = /<a href="[^"]*?anime\/([a-z0-9-]+)-([0-9]+)"[^>]*>[\s\S]*?<img src="([^"]*)" alt="([^"]*)"/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(resp.body)) !== null) {
        entries.push({
          _id: match[2],
          id: match[2],
          name: match[4],
          englishName: match[4],
          thumbnail: match[3],
          type: 'TV',
        })
      }
      return entries
    } catch {
      return []
    }
  }

  async getEpisodes(showId: string): Promise<EpisodeDetails | null> {
    try {
      const resp = await gotScraping({
        url: `${BASE}/api/frontend/anime/${showId}/episodes`,
        method: 'GET',
        headers: { Accept: 'application/json' },
        responseType: 'text',
      })
      if (resp.statusCode !== 200) return null
      const parsed = JSON.parse(resp.body)
      const list = parsed?.episodes || []
      return {
        episodes: list.map((e: any) => String(e.number || e.id)),
        description: '',
      }
    } catch {
      return null
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    return []
  }
}

export default new AniDBExtension()
