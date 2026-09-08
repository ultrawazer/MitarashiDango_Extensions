import { TvExtension, ExtensionMetadata, TvStreamOptions, TvStreamResult } from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'vidfast',
  name: 'VidFast',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'VidFast streaming player embed',
}

export class VidFastExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    const iframeUrl =
      options.mediaType === 'movie'
        ? `https://vidfast.pro/movie/${options.tmdbId}`
        : `https://vidfast.pro/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`

    return {
      iframeUrl,
      sources: [
        {
          sourceName: 'VidFast',
          links: [],
          type: 'iframe',
          iframeUrl,
        },
      ],
    }
  }
}

export default new VidFastExtension()
