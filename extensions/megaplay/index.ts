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
  id: 'megaplay',
  name: 'MegaPlay',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: 'Direct HLS anime streams from MegaPlay',
}

export class MegaPlayExtension implements AnimeExtension {
  readonly metadata = metadata
  private megaPlayBase = 'https://megaplay.buzz/stream/ani'
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    // Search using AniList public GraphQL endpoint
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `query ($search: String) {
            Page(page: 1, perPage: 15) {
              media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                id
                title { romaji english native }
                coverImage { large }
                format
                episodes
              }
            }
          }`,
          variables: { search: options.query },
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const list = data?.data?.Page?.media || []

      return list.map((m: any) => ({
        _id: String(m.id),
        id: String(m.id),
        anilistId: m.id,
        name: m.title?.english || m.title?.romaji || 'Unknown',
        thumbnail: m.coverImage?.large,
        type: m.format,
        episodeCount: m.episodes,
      }))
    } catch {
      return []
    }
  }

  async resolveShowId(title: string, _romaji?: string): Promise<string | null> {
    const results = await this.search({ query: title })
    return results[0]?._id || null
  }

  async getEpisodes(showId: string): Promise<EpisodeDetails | null> {
    const cacheKey = 'episodes_' + showId
    const cached = this.cache.get<EpisodeDetails>(cacheKey)
    if (cached) return cached

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id) { episodes description } }`,
          variables: { id: parseInt(showId, 10) },
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const count = data?.data?.Media?.episodes || 12
      const episodes = Array.from({ length: count }, (_, i) => String(i + 1))

      const result: EpisodeDetails = {
        episodes,
        description: data?.data?.Media?.description || '',
      }
      this.cache.set(cacheKey, result, 1800)
      return result
    } catch {
      return null
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    try {
      const res = await fetch(`${this.megaPlayBase}/${showId}/${episodeNumber}`, {
        headers: { Referer: 'https://megaplay.buzz/' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const data = await res.json()

      const streamUrl = data?.stream || data?.url || data?.link
      if (!streamUrl) return []

      return [
        {
          sourceName: 'MegaPlay HLS',
          links: [
            {
              resolutionStr: 'Auto',
              link: streamUrl,
              hls: true,
              headers: { Referer: 'https://megaplay.buzz/' },
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

export default new MegaPlayExtension()
