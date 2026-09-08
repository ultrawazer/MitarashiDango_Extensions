import * as cheerio from 'cheerio'
import { gotScraping } from 'got-scraping'
import {
  AnimeExtension,
  ExtensionMetadata,
  ExtensionContext,
  Show,
  VideoSource,
  EpisodeDetails,
  EpisodeDetail,
  SearchOptions,
  SimpleCache,
  pickBestMatch,
  buildQueryVariants,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'animepahe',
  name: 'AnimePahe',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: 'Stream anime directly from AnimePahe with sub/dub support',
}

interface AnimePaheSearchResult {
  session: string
  title: string
  name?: string
  poster?: string
  image?: string
  type?: string
  year?: number
}

interface AnimePaheEpisode {
  episode?: number
  number?: number
  session?: string
  release_session?: string
  title?: string
}

interface AnimePaheVideoSource {
  url: string
  quality: string | null
  fansub: string | null
  audio: string | null
}

interface AnimePaheApiResponse<T> {
  data?: T[]
  results?: T[]
  items?: T[]
  last_page?: number
  lastPage?: number
}

export class AnimePaheExtension implements AnimeExtension {
  readonly metadata = metadata
  private readonly BASE_URL = 'https://animepahe.pw'
  private readonly API_URL = 'https://animepahe.pw/api'
  private cache = new SimpleCache()

  private sanitizeCfClearance(cookie?: string): string | undefined {
    if (!cookie) return undefined
    const match = cookie.match(/cf_clearance=[^;]+/)
    return match ? match[0] : cookie
  }

  private async makeRequest<T>(
    url: string,
    responseType: 'json' | 'text' = 'json',
    referer?: string,
    context?: ExtensionContext
  ): Promise<T | null> {
    const headers: Record<string, string> = {
      Referer: referer || this.BASE_URL + '/',
      Accept: responseType === 'json' ? 'application/json' : 'text/html,application/xhtml+xml',
    }

    const ua = context?.ua
    const cookie = this.sanitizeCfClearance(context?.cookie)
    if (ua) headers['User-Agent'] = ua
    if (cookie) headers['Cookie'] = cookie

    try {
      const resp = await gotScraping({
        url,
        method: 'GET',
        headers,
        responseType: responseType === 'json' ? 'json' : 'text',
        timeout: { request: 30000 },
        followRedirect: true,
        throwHttpErrors: false,
      })

      if (resp.statusCode === 403 || resp.statusCode === 503) {
        throw new Error('AUTH_REQUIRED')
      }

      if (resp.statusCode !== 200) {
        return null
      }

      return resp.body as T
    } catch (error) {
      if ((error as Error).message === 'AUTH_REQUIRED') throw error
      return null
    }
  }

  async search(options: SearchOptions, context?: ExtensionContext): Promise<Show[]> {
    if (!options.query) return []
    const cacheKey = 'search_' + options.query
    const cached = this.cache.get<Show[]>(cacheKey)
    if (cached) return cached

    const url = `${this.API_URL}?m=search&q=${encodeURIComponent(options.query)}`
    const data = await this.makeRequest<AnimePaheApiResponse<AnimePaheSearchResult>>(url, 'json', undefined, context)
    const list = data?.data || data?.results || []

    const results: Show[] = list.map((item) => ({
      _id: item.session,
      id: item.session,
      session: item.session,
      name: item.title || item.name || '',
      englishName: item.title || item.name,
      thumbnail: item.poster || item.image,
      type: item.type,
      year: item.year,
    }))

    this.cache.set(cacheKey, results, 1800)
    return results
  }

  async resolveShowId(
    title: string,
    romaji?: string,
    _mode?: 'sub' | 'dub',
    context?: ExtensionContext
  ): Promise<string | null> {
    const variants = buildQueryVariants(title, romaji)
    for (const q of variants) {
      try {
        const results = await this.search({ query: q }, context)
        const match = pickBestMatch(
          results.map((r) => ({ title: r.name, id: r._id })),
          [title, romaji].filter((t): t is string => !!t)
        )
        if (match) return match.item.id || null
      } catch {}
    }
    return null
  }

  async getEpisodes(
    showId: string,
    _mode?: 'sub' | 'dub',
    context?: ExtensionContext
  ): Promise<EpisodeDetails | null> {
    const cacheKey = 'episodes_' + showId
    const cached = this.cache.get<EpisodeDetails>(cacheKey)
    if (cached) return cached

    let page = 1
    let lastPage = 1
    const episodes: string[] = []
    const availableEpisodesDetail: EpisodeDetail[] = []

    while (page <= lastPage) {
      const url = `${this.API_URL}?m=release&id=${showId}&sort=episode_asc&page=${page}`
      const data = await this.makeRequest<AnimePaheApiResponse<AnimePaheEpisode>>(url, 'json', undefined, context)
      if (!data) break

      lastPage = data.last_page || data.lastPage || 1
      const list = data.data || data.results || []

      for (const ep of list) {
        const epNum = String(ep.episode ?? ep.number ?? '')
        const epSession = ep.session || ep.release_session || ''
        if (epNum) {
          episodes.push(epNum)
          availableEpisodesDetail.push({
            number: epNum,
            title: ep.title,
            thumbnail: undefined,
          })
        }
      }
      page++
    }

    const result: EpisodeDetails = {
      episodes,
      description: '',
      availableEpisodesDetail,
    }
    this.cache.set(cacheKey, result, 1800)
    return result
  }

  private unpackKwik(p: string, a: number, c: number, k: string[]): string {
    const e = (c: number): string => (c < a ? '' : e(Math.floor(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36))
    const d: Record<string, string> = {}
    while (c--) d[e(c)] = k[c] || e(c)
    return p.replace(/\b\w+\b/g, (e) => d[e] || e)
  }

  private async resolveKwik(kwikUrl: string, context?: ExtensionContext): Promise<string | null> {
    const html = await this.makeRequest<string>(kwikUrl, 'text', this.BASE_URL + '/', context)
    if (!html) return null

    // Look for eval(function(p,a,c,k,e,d)...
    const match = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/)
    if (match) {
      const [_, p, a, c, k] = match
      const unpacked = this.unpackKwik(p, parseInt(a, 10), parseInt(c, 10), k.split('|'))
      const urlMatch = unpacked.match(/https:\/\/[^"']+\.m3u8[^"']*/i) || unpacked.match(/https:\/\/[^"']+\.mp4[^"']*/i)
      if (urlMatch) return urlMatch[0]
      const formAction = unpacked.match(/action="([^"]+)"/)
      const formToken = unpacked.match(/value="([^"]+)"/)
      if (formAction && formToken) {
        // Can resolve via POST if needed, but HLS / MP4 direct matches usually succeed
      }
    }
    const directMatch = html.match(/https:\/\/[^"']+\.m3u8[^"']*/i)
    return directMatch ? directMatch[0] : null
  }

  async getStreamUrls(
    showId: string,
    episodeNumber: string,
    _mode?: 'sub' | 'dub',
    context?: ExtensionContext
  ): Promise<VideoSource[] | null> {
    const playUrl = `${this.BASE_URL}/play/${showId}`
    const html = await this.makeRequest<string>(playUrl, 'text', this.BASE_URL + '/', context)
    if (!html) return []

    const $ = cheerio.load(html)
    const sources: VideoSource[] = []

    const dropDownButtons = $('#pickDownload a, .dropdown-item, a[href*="kwik"]')
    const kwikLinks: { url: string; quality: string }[] = []

    dropDownButtons.each((_, el) => {
      const href = $(el).attr('href') || ''
      const text = $(el).text().trim()
      if (href.includes('kwik') || href.includes('uwu')) {
        kwikLinks.push({ url: href, quality: text || 'Default' })
      }
    })

    for (const kwik of kwikLinks) {
      try {
        const streamUrl = await this.resolveKwik(kwik.url, context)
        if (streamUrl) {
          sources.push({
            sourceName: `AnimePahe (${kwik.quality})`,
            links: [
              {
                resolutionStr: kwik.quality,
                link: streamUrl,
                hls: streamUrl.includes('.m3u8'),
                headers: { Referer: 'https://kwik.cx/' },
              },
            ],
            type: 'player',
          })
        }
      } catch {}
    }

    return sources
  }
}

export default new AnimePaheExtension()
