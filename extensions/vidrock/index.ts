import { TvExtension, ExtensionMetadata, TvStreamOptions, TvStreamResult } from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'vidrock',
  name: 'VidRock',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'VidRock streaming player embed',
}

export class VidRockExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    const iframeUrl =
      options.mediaType === 'movie'
        ? `https://vidrock.ru/movie/${options.tmdbId}`
        : `https://vidrock.ru/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`

    return {
      iframeUrl,
      sources: [
        {
          sourceName: 'VidRock',
          links: [],
          type: 'iframe',
          iframeUrl,
        },
      ],
    }
  }
}

export default new VidRockExtension()
