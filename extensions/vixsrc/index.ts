import {
  TvExtension,
  ExtensionMetadata,
  TvStreamOptions,
  TvStreamResult,
  VideoSource,
} from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'vixsrc',
  name: 'VixSrc (HLS)',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'Direct HLS streams and multi-language subtitles from VixSrc',
}

const BASE_URL = 'https://vixsrc.to'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 Chrome/150 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  Referer: BASE_URL,
  Origin: BASE_URL,
}

export class VixSrcExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    try {
      const pageUrl =
        options.mediaType === 'movie'
          ? `${BASE_URL}/api/movie/${options.tmdbId}`
          : `${BASE_URL}/api/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`

      const apiRes = await fetch(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
      if (!apiRes.ok) return { sources: [], error: 'VixSrc API error' }
      const apiData = await apiRes.json()
      if (!apiData?.src) return { sources: [] }

      const htmlUrl = BASE_URL + apiData.src
      const htmlRes = await fetch(htmlUrl, { headers: { ...HEADERS, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(10000) })
      if (!htmlRes.ok) return { sources: [] }
      const html = await htmlRes.text()

      const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1]
      const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1]
      const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1]
      if (!token || !expires || !playlist) return { sources: [] }

      const sep = playlist.includes('?') ? '&' : '?'
      const masterUrl = `${playlist}${sep}token=${token}&expires=${expires}&h=1`

      return {
        sources: [
          {
            sourceName: 'VixSrc Master HLS',
            links: [
              {
                resolutionStr: 'Auto',
                link: masterUrl,
                hls: true,
                headers: { Referer: pageUrl },
              },
            ],
            type: 'player',
          },
        ],
      }
    } catch (e) {
      return { sources: [], error: (e as Error).message }
    }
  }
}

export default new VixSrcExtension()
