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
  version: '1.0.1',
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

  private async fetchHtml(url: string, referer: string = BASE_URL + '/'): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
          Referer: referer,
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

    $('article, .item').each((_, el) => {
      const titleEl = $(el).find('.data h3 a, h3 a, .title a, a[title]').first()
      const rawTitle = titleEl.text().trim() || titleEl.attr('title') || $(el).find('img').attr('title') || ''
      const cleanTitle = rawTitle.replace(/^Watch\s+Hentai\s+/i, '').replace(/\[.*?\]/g, '').split('\n')[0].trim()
      const href = titleEl.attr('href') || $(el).find('a').first().attr('href') || ''
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || ''
      const slug = href.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '')

      if (cleanTitle && slug && !slug.startsWith('videos/') && !results.find((r) => r.id === slug)) {
        results.push({
          _id: slug,
          id: slug,
          name: cleanTitle,
          englishName: cleanTitle,
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
    const cleanId = showId.replace(/^\/+|\/+$/g, '')
    const pageUrl = `${BASE_URL}/${cleanId}/`
    const html = await this.fetchHtml(pageUrl)
    if (!html) return null

    const $ = cheerio.load(html)
    const episodes: string[] = []
    const epUrls = new Map<string, string>()

    $('ul.episodios li a, .episodios li a, .episodios a').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href || href.startsWith('#') || !href.includes('/videos/')) return
      const text = $(el).text() || ''
      const m = text.match(/Episode\s*(\d+)/i) || href.match(/episode-(\d+)/i) || text.match(/(\d+)/)
      if (m) {
        const num = m[1]
        if (!episodes.includes(num)) {
          episodes.push(num)
          epUrls.set(num, href)
        }
      }
    })

    if (episodes.length === 0) episodes.push('1')
    if (epUrls.size > 0) {
      this.cache.set(`ep_urls_${cleanId}`, Object.fromEntries(epUrls), 3600)
    }

    return {
      episodes,
      description: $('.entry-content p').first().text().trim() || '',
    }
  }

  async getStreamUrls(showId: string, episodeNumber: string): Promise<VideoSource[] | null> {
    const cleanId = showId.replace(/^\/+|\/+$/g, '')
    const cachedUrls = this.cache.get<Record<string, string>>(`ep_urls_${cleanId}`)
    let epUrl = cachedUrls ? cachedUrls[String(episodeNumber)] : null

    if (!epUrl) {
      const baseSlug = cleanId.replace(/^series\//, '')
      epUrl = `${BASE_URL}/videos/${baseSlug}-episode-${episodeNumber}-id-01/`
    }

    let epHtml = await this.fetchHtml(epUrl)
    if (!epHtml && epUrl.includes('-id-01')) {
      epHtml = await this.fetchHtml(epUrl.replace('-id-01', ''))
    }
    if (!epHtml) {
      epHtml = await this.fetchHtml(`${BASE_URL}/${cleanId}/`)
    }
    if (!epHtml) return []

    const $ = cheerio.load(epHtml)
    const iframe = $('#search_iframe, iframe.metaframe, iframe')
    const playerUrl =
      iframe.attr('data-primary-player-url') ||
      iframe.attr('data-alternate-player-url') ||
      $('meta[itemprop="contentUrl"]').attr('content') ||
      iframe.attr('src')

    const sources: VideoSource[] = []
    if (playerUrl && playerUrl.startsWith('http')) {
      const playerHtml = await this.fetchHtml(playerUrl, epUrl)
      if (playerHtml) {
        const mp4Matches = [...playerHtml.matchAll(/https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*/g)].map((m) => m[0])
        const uniqueLinks = [...new Set(mp4Matches)]
        if (uniqueLinks.length > 0) {
          sources.push({
            sourceName: 'WH Direct',
            links: uniqueLinks.map((l) => ({ resolutionStr: '1080p', link: l, hls: l.includes('.m3u8') })),
            type: 'player',
          })
        }
      }
      if (sources.length === 0) {
        sources.push({
          sourceName: 'WH Player',
          links: [],
          type: 'iframe',
          iframeUrl: playerUrl,
        })
      }
    }

    const encodedMatches = epHtml.matchAll(/data-video=["']([^"']+)["']/g)
    for (const match of encodedMatches) {
      const decoded = whDecode(match[1])
      if (decoded.includes('http') && !sources.find((s) => s.links?.[0]?.link === decoded)) {
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
