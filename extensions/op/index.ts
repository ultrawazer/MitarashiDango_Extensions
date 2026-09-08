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
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from OppaiStream',
}

const BASE_URL = 'https://oppai.stream'

export class OpExtension implements AnimeExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    try {
      const res = await fetch(`${BASE_URL}/actions/search.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: BASE_URL + '/',
          'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        },
        body: `q=${encodeURIComponent(options.query)}`,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return []
      const html = await res.text()

      const entries: Show[] = []
      const re = /<div\s+class='in-grid episode-shown'[^>]*folder='([^']+)'[^>]*name='([^']+)'[^>]*desc='([^']*)'/g
      let m: RegExpExecArray | null
      const seen = new Set<string>()

      while ((m = re.exec(html)) !== null) {
        const folder = m[1]
        const name = m[2]
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
      }
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
    return {
      episodes: ['1'],
      description: '',
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    return []
  }
}

export default new OpExtension()
