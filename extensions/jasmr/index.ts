import * as cheerio from 'cheerio'
import {
  AsmrExtension,
  ExtensionMetadata,
  ExtensionContext,
  Show,
  VideoSource,
  EpisodeDetails,
  AsmrBrowseOptions,
  SimpleCache,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'jasmr',
  name: 'Japanese ASMR',
  version: '1.0.1',
  type: 'asmr',
  lang: 'ja',
  mature: true,
  description: 'Japanese ASMR audio drama streams from japaneseasmr.com',
  authUrl: 'https://japaneseasmr.com',
}

const BASE_URL = 'https://japaneseasmr.com'

export class JasmrExtension implements AsmrExtension {
  readonly metadata = metadata
  private cache = new SimpleCache()

  private async fetchHtml(url: string, context?: ExtensionContext): Promise<string | null> {
    const headers: Record<string, string> = {
      'User-Agent': context?.ua || context?.jasmr_ua || 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
      Referer: BASE_URL + '/',
    }
    const cookie = context?.cookie || context?.jasmr_cookie
    if (cookie) headers['Cookie'] = cookie

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
      if (res.status === 403) throw new Error('AUTH_REQUIRED')
      return res.ok ? await res.text() : null
    } catch (e) {
      if ((e as Error).message === 'AUTH_REQUIRED') throw e
      return null
    }
  }

  async browse(options: AsmrBrowseOptions, context?: ExtensionContext): Promise<{ shows: Show[]; hasNext: boolean }> {
    const page = options.page || 1
    const q = options.query ? `?s=${encodeURIComponent(options.query)}` : `/page/${page}/`
    const url = `${BASE_URL}${q}`
    const html = await this.fetchHtml(url, context)
    if (!html) return { shows: [], hasNext: false }

    const $ = cheerio.load(html)
    const shows: Show[] = []

    $('article, .post').each((_, el) => {
      const title = $(el).find('.entry-title a').text().trim()
      const href = $(el).find('.entry-title a').attr('href') || ''
      const rjMatch = title.match(/RJ\d+/i) || href.match(/RJ\d+/i)
      const rjCode = rjMatch ? rjMatch[0].toUpperCase() : ''
      const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || ''

      if (title && rjCode) {
        shows.push({
          _id: rjCode,
          id: rjCode,
          name: title,
          thumbnail: thumb,
          type: 'ASMR',
          isAdult: true,
        })
      }
    })

    const hasNext = $('.nav-previous, .next, a:contains("Next")').length > 0
    return { shows, hasNext }
  }

  async getEpisodes(rjCode: string, context?: ExtensionContext): Promise<EpisodeDetails | null> {
    const url = `${BASE_URL}/${rjCode}/`
    const html = await this.fetchHtml(url, context)
    if (!html) return null

    const $ = cheerio.load(html)
    const tracks: string[] = []
    $('audio source, a[href*=".mp3"], a[href*=".m4a"]').each((i, el) => {
      tracks.push(String(i + 1))
    })

    return {
      episodes: tracks.length ? tracks : ['1'],
      description: $('.entry-content p').text().trim() || '',
    }
  }

  async getStreamUrls(rjCode: string, _episodeNumber?: string, context?: ExtensionContext): Promise<VideoSource[] | null> {
    const url = `${BASE_URL}/${rjCode}/`
    const html = await this.fetchHtml(url, context)
    if (!html) return []

    const $ = cheerio.load(html)
    const links: any[] = []

    $('audio source, a[href*=".mp3"], a[href*=".m4a"]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href')
      if (src && !links.find((l) => l.link === src)) {
        links.push({
          resolutionStr: 'Audio Track',
          link: src,
          hls: false,
        })
      }
    })

    return [
      {
        sourceName: 'JASMR Audio',
        links,
        type: 'player',
      },
    ]
  }

  async getImages(rjCode: string, context?: ExtensionContext): Promise<string[]> {
    const url = `${BASE_URL}/${rjCode}/`
    const html = await this.fetchHtml(url, context)
    if (!html) return []

    const $ = cheerio.load(html)
    const images: string[] = []

    $('.entry-content img').each((_, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src')
      if (src && !images.includes(src)) images.push(src)
    })

    return images
  }
}

export default new JasmrExtension()
