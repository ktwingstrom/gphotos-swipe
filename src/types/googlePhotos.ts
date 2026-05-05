export interface GoogleMediaItem {
  id: string
  baseUrl: string
  mimeType: string
  filename: string
  productUrl?: string
  mediaMetadata: {
    creationTime: string
    width: string
    height: string
    photo?: {
      cameraMake?: string
      cameraModel?: string
      focalLength?: number
      apertureFNumber?: number
      isoEquivalent?: number
      exposureTime?: string
    }
    video?: {
      fps?: number
      status?: 'UNSPECIFIED' | 'PROCESSING' | 'READY' | 'FAILED'
    }
  }
}

export interface GoogleAlbum {
  id: string
  title?: string
  albumName: string
  isWriteable?: boolean
  mediaItemsCount?: string
  coverPhotoBaseUrl?: string
}

export interface MediaItemsListResponse {
  mediaItems?: GoogleMediaItem[]
  nextPageToken?: string
}

export interface MediaItemsSearchResponse {
  mediaItems?: GoogleMediaItem[]
  nextPageToken?: string
}

export interface AlbumsListResponse {
  albums?: GoogleAlbum[]
  nextPageToken?: string
}

export interface TimeBucket {
  timeBucket: string
  count: number
}
