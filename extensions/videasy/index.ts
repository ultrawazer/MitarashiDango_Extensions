import { TvExtension, ExtensionMetadata, TvStreamOptions, TvStreamResult } from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'videasy',
  name: 'VidEasy',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'VidEasy streaming player embed with overlay controls',
}

export class VidEasyExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    const iframeUrl =
      options.mediaType === 'movie'
        ? `https://player.videasy.to/movie/${options.tmdbId}?overlay=true`
        : `https://player.videasy.to/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}?episodeSelector=true&overlay=true`

    return {
      iframeUrl,
      sources: [
        {
          sourceName: 'VidEasy',
          links: [],
          type: 'iframe',
          iframeUrl,
        },
      ],
    }
  }
}

export default new VidEasyExtension()
