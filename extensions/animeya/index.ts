import * as cheerio from 'cheerio'
import {
  AnimeExtension,
  ExtensionMetadata,
  ExtensionContext,
  Show,
  VideoSource,
  EpisodeDetails,
  SearchOptions,
  SimpleCache,
  pickBestMatch,
  buildQueryVariants,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'animeya',
  name: 'Animeya',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: false,
  description: 'Stream anime from Animeya',
}

export class AnimeyaExtension implements AnimeExtension {
  readonly metadata = metadata
  private readonly BASE_URL = 'https://animeya.cc'
  private cache = new SimpleCache()

  private async fetchHtml(url: string, referer?: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          Referer: referer || this.BASE_URL + '/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }

  async search(options: SearchOptions): Promise<Show[]> {
    if (!options.query) return []
    const cacheKey = 'search_' + options.query
    const cached = this.cache.get<Show[]>(cacheKey)
    if (cached) return cached

    const url = `${this.BASE_URL}/search?keyword=${encodeURIComponent(options.query)}`
    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const results: Show[] = []

    $('.film_list-wrap .flw-item').each((_, el) => {
      const title = $(el).find('.film-name a').text().trim()
      const href = $(el).find('.film-name a').attr('href') || ''
      const img = $(el).find('.film-poster-img').attr('data-src') || $(el).find('.film-poster-img').attr('src') || ''
      const slug = href.replace(/^\//, '').replace(/^watch\//, '')

      if (title && slug) {
        results.push({
          _id: slug,
          id: slug,
          name: title,
          englishName: title,
          thumbnail: img,
          type: 'TV',
        })
      }
    })

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

    const cleanSlug = showId.replace(/^watch\//, '')
    const url = `${this.BASE_URL}/${cleanSlug}`
    const html = await this.fetchHtml(url)
    if (!html) return null

    const $ = cheerio.load(html)
    const episodes: string[] = []

    $('.episodes-list a, .ssl-item').each((_, el) => {
      const epNum = $(el).attr('data-number') || $(el).text().trim().replace(/[^0-9]/g, '')
      if (epNum && !episodes.includes(epNum)) {
        episodes.push(epNum)
      }
    })

    const result: EpisodeDetails = {
      episodes,
      description: $('.description, .film-description').text().trim() || '',
    }
    this.cache.set(cacheKey, result, 1800)
    return result
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    const cleanSlug = showId.replace(/^watch\//, '')
    const url = `${this.BASE_URL}/watch/${cleanSlug}?ep=${episodeNumber}`
    const html = await this.fetchHtml(url)
    if (!html) return []

    const $ = cheerio.load(html)
    const sources: VideoSource[] = []

    const iframeSrc = $('iframe').attr('src')
    if (iframeSrc) {
      sources.push({
        sourceName: 'Animeya Player',
        links: [],
        type: 'iframe',
        iframeUrl: iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc,
      })
    }

    return sources
  }
}

export default new AnimeyaExtension()
