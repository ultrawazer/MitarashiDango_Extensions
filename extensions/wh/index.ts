import * as cheerio from 'cheerio'
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
  id: 'wh',
  name: 'WH',
  version: '1.0.0',
  type: 'anime',
  lang: 'en',
  mature: true,
  description: 'Mature anime from WatchHentai',
}

const BASE_URL = 'https://watchhentai.net'

function whDecode(encoded: string): string {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const bytes = Buffer.from(padded, 'base64')
    let xored = ''
    for (let i = 0; i < bytes.length; i++) {
      xored += String.fromCharCode(bytes[i] ^ 0x7f)
    }
    return decodeURIComponent(xored)
  } catch {
    return encoded
  }
}

export class WhExtension implements AnimeExtension {
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

    const html = await this.fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(options.query)}`)
    if (!html) return []

    const $ = cheerio.load(html)
    const results: Show[] = []

    $('article, .post-item, .video-block').each((_, el) => {
      const link = $(el).find('a').first()
      const href = link.attr('href') || ''
      const title = $(el).find('.entry-title, .title').text().trim() || link.attr('title') || ''
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || ''
      const slug = href.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '')

      if (title && slug) {
        results.push({
          _id: slug,
          id: slug,
          name: title,
          englishName: title,
          thumbnail: img,
          type: 'OVA',
          isAdult: true,
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
    const html = await this.fetchHtml(`${BASE_URL}/${showId}/`)
    if (!html) return null

    const $ = cheerio.load(html)
    const episodes: string[] = []

    $('.episodes a, .episode-list a').each((_, el) => {
      const num = $(el).text().trim().replace(/[^0-9]/g, '')
      if (num && !episodes.includes(num)) episodes.push(num)
    })

    if (episodes.length === 0) episodes.push('1')

    return {
      episodes,
      description: $('.entry-content p').first().text().trim() || '',
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    const html = await this.fetchHtml(`${BASE_URL}/${showId}/episode-${episodeNumber}/`) || await this.fetchHtml(`${BASE_URL}/${showId}/`)
    if (!html) return []

    const sources: VideoSource[] = []
    const encodedMatches = html.matchAll(/data-video=["']([^"']+)["']/g)
    for (const match of encodedMatches) {
      const decoded = whDecode(match[1])
      if (decoded.includes('http')) {
        sources.push({
          sourceName: 'WH Stream',
          links: [{ resolutionStr: 'Auto', link: decoded, hls: decoded.includes('.m3u8') }],
          type: 'player',
        })
      }
    }

    return sources
  }
}

export default new WhExtension()
