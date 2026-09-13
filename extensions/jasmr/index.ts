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
  version: '1.0.2',
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

  private async resolvePostUrl(idOrRj: string, context?: ExtensionContext): Promise<string | null> {
    if (!idOrRj) return null
    const cached = this.cache.get<string>('post_url_' + idOrRj)
    if (cached) return cached

    if (/^\d+$/.test(idOrRj)) {
      const u = `${BASE_URL}/${idOrRj}/`
      this.cache.set('post_url_' + idOrRj, u, 86400)
      return u
    }

    const searchHtml = await this.fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(idOrRj)}`, context)
    if (!searchHtml) return null
    const $ = cheerio.load(searchHtml)
    const href = $('.entry-title a').first().attr('href') || null
    if (href) {
      this.cache.set('post_url_' + idOrRj, href, 86400)
    }
    return href
  }

  async browse(options: AsmrBrowseOptions, context?: ExtensionContext): Promise<{ shows: Show[]; hasNext: boolean }> {
    const page = options.page || 1
    let q = `/page/${page}/`
    if (options.query) {
      q = page > 1 ? `/page/${page}/?s=${encodeURIComponent(options.query)}` : `?s=${encodeURIComponent(options.query)}`
    }
    const url = `${BASE_URL}${q}`
    const html = await this.fetchHtml(url, context)
    if (!html) return { shows: [], hasNext: false }

    const $ = cheerio.load(html)
    const shows: Show[] = []

    $('article, .post').each((_, el) => {
      const title = $(el).find('.entry-title a').text().trim()
      const href = $(el).find('.entry-title a').attr('href') || ''
      const thumb = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || ''
      const text = $(el).text()
      const rjMatch = title.match(/RJ\d+/i) || href.match(/RJ\d+/i) || thumb.match(/RJ\d+/i) || text.match(/RJ\d+/i)
      const rjCode = rjMatch ? rjMatch[0].toUpperCase() : ''
      const idMatch = href.match(/\/(\d+)\/?$/)
      const postId = idMatch ? idMatch[1] : ''
      const showId = rjCode || postId

      if (title && showId) {
        if (href) {
          this.cache.set('post_url_' + showId, href, 86400)
          if (rjCode) this.cache.set('post_url_' + rjCode, href, 86400)
          if (postId) this.cache.set('post_url_' + postId, href, 86400)
        }
        shows.push({
          _id: showId,
          id: showId,
          name: title,
          thumbnail: thumb,
          type: 'ASMR',
          isAdult: true,
          rj: rjCode || showId,
        })
      }
    })

    const hasNext = $('.nav-previous, .next, a:contains("Next")').length > 0
    return { shows, hasNext }
  }

  async getEpisodes(idOrRj: string, context?: ExtensionContext): Promise<EpisodeDetails | null> {
    const postUrl = await this.resolvePostUrl(idOrRj, context)
    if (!postUrl) return null
    const html = await this.fetchHtml(postUrl, context)
    if (!html) return null

    const $ = cheerio.load(html)
    const tracks: string[] = []
    $('#plyr-chapter-playlist tr, .tracklist tr').each((_, el) => {
      const time = $(el).find('td').first().text().trim()
      if (/^\d{2}:\d{2}/.test(time)) {
        tracks.push(String(tracks.length + 1))
      }
    })

    return {
      episodes: tracks.length ? tracks : ['1'],
      description: $('.entry-content p').first().text().trim() || '',
    }
  }

  async getStreamUrls(idOrRj: string, _episodeNumber?: string, context?: ExtensionContext): Promise<VideoSource[] | null> {
    const postUrl = await this.resolvePostUrl(idOrRj, context)
    if (!postUrl) return []
    const html = await this.fetchHtml(postUrl, context)
    if (!html) return []

    const $ = cheerio.load(html)
    const links: any[] = []

    const addLink = (src?: string) => {
      if (src && !links.find((l) => l.link === src)) {
        links.push({
          resolutionStr: 'Audio Track',
          link: src,
          hls: src.includes('.m3u8'),
        })
      }
    }

    const directAudio = $('audio#audio, audio').attr('src')
    if (directAudio) addLink(directAudio)

    $('audio source, source').each((_, el) => {
      addLink($(el).attr('src'))
    })

    $('a[href*=".mp3"], a[href*=".m4a"], a[href*=".m3u8"]').each((_, el) => {
      addLink($(el).attr('href'))
    })

    $('script').each((_, el) => {
      const sc = $(el).html() || ''
      const m = sc.match(/audioSrc\s*=\s*['"]([^'"]+)['"]/)
      if (m) addLink(m[1])
    })

    return [
      {
        sourceName: 'JASMR Audio',
        links,
        type: 'player',
      },
    ]
  }

  async getImages(idOrRj: string, context?: ExtensionContext): Promise<string[]> {
    const postUrl = await this.resolvePostUrl(idOrRj, context)
    if (!postUrl) return []
    const html = await this.fetchHtml(postUrl, context)
    if (!html) return []

    const $ = cheerio.load(html)
    const images: string[] = []

    $('.entry-content img, .op-square img').each((_, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src')
      if (src && !images.includes(src)) images.push(src)
    })

    return images
  }

  async getChapters(idOrRj: string, context?: ExtensionContext): Promise<unknown[]> {
    const postUrl = await this.resolvePostUrl(idOrRj, context)
    if (!postUrl) return []
    const html = await this.fetchHtml(postUrl, context)
    if (!html) return []

    const $ = cheerio.load(html)
    const chapters: { title: string; time: string }[] = []

    $('#plyr-chapter-playlist tr').each((_, el) => {
      const time = $(el).find('td').first().text().trim()
      const rawTitle = $(el).find('td a, td:nth-child(2)').text().trim()
      const cleanTitle = rawTitle.replace(/^\d{2}:\d{2}:\d{2}\s*/, '').replace(/#$/, '').trim()
      if (cleanTitle && time && /^\d{2}:\d{2}/.test(time)) {
        chapters.push({ title: cleanTitle, time })
      }
    })

    return chapters
  }
}

export default new JasmrExtension()
