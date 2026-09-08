import { TvExtension, ExtensionMetadata, TvStreamOptions, TvStreamResult } from '@dango/extension-core'

export const metadata: ExtensionMetadata = {
  id: 'embedmaster',
  name: 'EmbedMaster',
  version: '1.0.0',
  type: 'tv',
  lang: 'en',
  mature: false,
  description: 'EmbedMaster streaming player embed',
}

export class EmbedMasterExtension implements TvExtension {
  readonly metadata = metadata

  async getStreamUrls(options: TvStreamOptions): Promise<TvStreamResult | null> {
    const iframeUrl =
      options.mediaType === 'movie'
        ? `https://embedmaster.link/movie/${options.tmdbId}`
        : `https://embedmaster.link/tv/${options.tmdbId}/${options.season || 1}/${options.episode || 1}`

    return {
      iframeUrl,
      sources: [
        {
          sourceName: 'EmbedMaster',
          links: [],
          type: 'iframe',
          iframeUrl,
        },
      ],
    }
  }
}

export default new EmbedMasterExtension()
