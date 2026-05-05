import { ref, computed } from 'vue'
import { useGoogleAuthStore } from '@/stores/googleAuth'
import { useUiStore } from '@/stores/ui'
import { useReviewedStore } from '@/stores/reviewed'
import { usePreferencesStore } from '@/stores/preferences'
import type {
  GoogleMediaItem,
  GoogleAlbum,
  MediaItemsListResponse,
  MediaItemsSearchResponse,
  AlbumsListResponse,
  TimeBucket,
} from '@/types/googlePhotos'

export type SwipeMode = 'random' | 'recents' | 'month' | 'on-this-day'
export type ContentFilter = 'any' | 'IMAGE' | 'VIDEO'

const BASE_URL = 'https://photoslibrary.googleapis.com/v1'
const PAGE_SIZE = 100
const TO_DELETE_ALBUM_KEY = 'gphotos-to-delete-album-id'

export function useGooglePhotos() {
  const authStore = useGoogleAuthStore()
  const uiStore = useUiStore()
  const reviewedStore = useReviewedStore()
  const preferencesStore = usePreferencesStore()

  const currentAsset = ref<GoogleMediaItem | null>(null)
  const nextAsset = ref<GoogleMediaItem | null>(null)
  const pendingAssets = ref<GoogleMediaItem[]>([])
  const error = ref<string | null>(null)
  const modeTotal = ref<number>(0)

  let pageToken: string | undefined = undefined
  let hasMorePages = false
  let isFetchingMore = false
  let currentContentFilter: ContentFilter = 'any'

  type ReviewAction = {
    asset: GoogleMediaItem
    type: 'keep' | 'delete' | 'keepToAlbum'
    albumId?: string
    albumName?: string
  }
  const actionHistory = ref<ReviewAction[]>([])
  const albumsCache = ref<GoogleAlbum[] | null>(null)

  function isReviewable(item: GoogleMediaItem): boolean {
    return !reviewedStore.isReviewed(item.id)
  }

  function resetFlow() {
    pendingAssets.value = []
    nextAsset.value = null
    actionHistory.value = []
    pageToken = undefined
    hasMorePages = false
    isFetchingMore = false
  }

  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await authStore.getValidToken()
    if (!token) throw new Error('Not authenticated')

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`API error ${response.status}: ${text}`)
    }

    const text = await response.text()
    if (!text) return {} as T
    return JSON.parse(text)
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function getThumbnailUrl(item: GoogleMediaItem): string {
    return `${item.baseUrl}=w800-h800`
  }

  function getVideoUrl(item: GoogleMediaItem): string {
    return `${item.baseUrl}=dv`
  }

  function isVideo(item: GoogleMediaItem): boolean {
    return item.mimeType.startsWith('video/')
  }

  function getAuthHeaders(): Record<string, string> {
    const token = authStore.accessToken || ''
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchMediaItemsPage(token?: string, contentFilter: ContentFilter = 'any'): Promise<{ items: GoogleMediaItem[]; nextPageToken?: string }> {
    if (contentFilter !== 'any') {
      const googleType = contentFilter === 'IMAGE' ? 'PHOTO' : 'VIDEO'
      const body = {
        pageSize: PAGE_SIZE,
        pageToken: token,
        filters: { mediaTypeFilter: { mediaTypes: [googleType] } },
      }
      const resp = await apiRequest<MediaItemsSearchResponse>('/mediaItems:search', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return { items: resp.mediaItems ?? [], nextPageToken: resp.nextPageToken }
    }

    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) })
    if (token) params.set('pageToken', token)
    const resp = await apiRequest<MediaItemsListResponse>(`/mediaItems?${params}`)
    return { items: resp.mediaItems ?? [], nextPageToken: resp.nextPageToken }
  }

  async function fetchByDateRange(
    from: string,
    to: string,
    contentFilter: ContentFilter = 'any'
  ): Promise<GoogleMediaItem[]> {
    const allItems: GoogleMediaItem[] = []
    let nextToken: string | undefined

    const fromDate = new Date(from)
    const toDate = new Date(to)

    const filters: Record<string, unknown> = {
      dateFilter: {
        ranges: [
          {
            startDate: { year: fromDate.getUTCFullYear(), month: fromDate.getUTCMonth() + 1, day: fromDate.getUTCDate() },
            endDate: { year: toDate.getUTCFullYear(), month: toDate.getUTCMonth() + 1, day: toDate.getUTCDate() },
          },
        ],
      },
    }

    if (contentFilter !== 'any') {
      filters.mediaTypeFilter = { mediaTypes: [contentFilter === 'IMAGE' ? 'PHOTO' : 'VIDEO'] }
    }

    do {
      const body: Record<string, unknown> = { pageSize: PAGE_SIZE, filters }
      if (nextToken) body.pageToken = nextToken

      const resp = await apiRequest<MediaItemsSearchResponse>('/mediaItems:search', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      allItems.push(...(resp.mediaItems ?? []))
      nextToken = resp.nextPageToken
    } while (nextToken)

    return allItems
  }

  async function fetchRecents(contentFilter: ContentFilter = 'any'): Promise<GoogleMediaItem[]> {
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    return fetchByDateRange(ninetyDaysAgo.toISOString(), now.toISOString(), contentFilter)
  }

  async function fetchByMonth(year: number, month: number, contentFilter: ContentFilter = 'any'): Promise<GoogleMediaItem[]> {
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString()
    return fetchByDateRange(from, to, contentFilter)
  }

  async function fetchMemoryAssets(contentFilter: ContentFilter = 'any'): Promise<GoogleMediaItem[]> {
    const now = new Date()
    const filters: Record<string, unknown> = {
      dateFilter: {
        dates: [{ month: now.getMonth() + 1, day: now.getDate() }],
      },
    }
    if (contentFilter !== 'any') {
      filters.mediaTypeFilter = { mediaTypes: [contentFilter === 'IMAGE' ? 'PHOTO' : 'VIDEO'] }
    }

    const allItems: GoogleMediaItem[] = []
    let nextToken: string | undefined

    do {
      const body: Record<string, unknown> = { pageSize: PAGE_SIZE, filters }
      if (nextToken) body.pageToken = nextToken
      const resp = await apiRequest<MediaItemsSearchResponse>('/mediaItems:search', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      allItems.push(...(resp.mediaItems ?? []))
      nextToken = resp.nextPageToken
    } while (nextToken)

    return allItems
  }

  function fetchTimeBuckets(): TimeBucket[] {
    const buckets: TimeBucket[] = []
    const now = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
      buckets.push({ timeBucket: d.toISOString(), count: 0 })
    }
    return buckets
  }

  async function fetchAlbums(force = false): Promise<GoogleAlbum[]> {
    if (albumsCache.value && !force) return albumsCache.value

    const albums: GoogleAlbum[] = []
    let nextToken: string | undefined

    do {
      const params = new URLSearchParams({ pageSize: '50' })
      if (nextToken) params.set('pageToken', nextToken)
      const resp = await apiRequest<AlbumsListResponse>(`/albums?${params}`)
      for (const a of resp.albums ?? []) {
        albums.push({ ...a, albumName: a.title ?? '' })
      }
      nextToken = resp.nextPageToken
    } while (nextToken)

    albumsCache.value = albums
    return albums
  }

  async function getOrCreateToDeleteAlbum(): Promise<string> {
    const cached = localStorage.getItem(TO_DELETE_ALBUM_KEY)
    if (cached) return cached

    // Search existing albums first
    const albums = await fetchAlbums()
    const existing = albums.find(a => a.title === 'To Delete')
    if (existing) {
      localStorage.setItem(TO_DELETE_ALBUM_KEY, existing.id)
      return existing.id
    }

    // Create new
    const created = await apiRequest<{ id: string }>('/albums', {
      method: 'POST',
      body: JSON.stringify({ album: { title: 'To Delete' } }),
    })
    localStorage.setItem(TO_DELETE_ALBUM_KEY, created.id)
    albumsCache.value = null  // invalidate cache
    return created.id
  }

  async function addToAlbum(albumId: string, mediaItemId: string): Promise<void> {
    await apiRequest(`/albums/${albumId}:addMediaItems`, {
      method: 'POST',
      body: JSON.stringify({ mediaItemIds: [mediaItemId] }),
    })
  }

  async function dequeueNext(): Promise<GoogleMediaItem | null> {
    while (pendingAssets.value.length > 0) {
      const item = pendingAssets.value.shift()!
      if (isReviewable(item)) return item
    }

    if (hasMorePages && !isFetchingMore) {
      isFetchingMore = true
      try {
        const { items, nextPageToken } = await fetchMediaItemsPage(pageToken, currentContentFilter)
        pageToken = nextPageToken
        hasMorePages = !!nextPageToken
        const shuffled = shuffle(items)
        pendingAssets.value.push(...shuffled)
      } finally {
        isFetchingMore = false
      }

      while (pendingAssets.value.length > 0) {
        const item = pendingAssets.value.shift()!
        if (isReviewable(item)) return item
      }
    }

    return null
  }

  function moveToNextAsset() {
    if (nextAsset.value) {
      currentAsset.value = nextAsset.value
      nextAsset.value = null
      preloadNextAsset()
    } else {
      loadNextAsset()
    }
  }

  async function loadNextAsset() {
    const item = await dequeueNext()
    if (item) {
      currentAsset.value = item
      preloadNextAsset()
    } else {
      currentAsset.value = null
      error.value = 'No more photos to review!'
    }
  }

  async function preloadNextAsset() {
    try {
      const item = await dequeueNext()
      nextAsset.value = item
    } catch {
      // silent
    }
  }

  function enqueuePendingAsset(asset: GoogleMediaItem | null) {
    if (!asset || reviewedStore.isReviewed(asset.id)) return
    pendingAssets.value = [asset, ...pendingAssets.value.filter(i => i.id !== asset.id)]
  }

  function setCurrentWithFallback(asset: GoogleMediaItem, resume: GoogleMediaItem | null) {
    currentAsset.value = asset
    if (resume && resume.id !== asset.id) {
      nextAsset.value = resume
    } else if (!nextAsset.value) {
      preloadNextAsset()
    }
  }

  async function loadMode(
    mode: SwipeMode,
    options?: { year?: number; month?: number; contentFilter?: ContentFilter }
  ): Promise<void> {
    try {
      uiStore.setLoading(true, 'Loading...')
      error.value = null
      resetFlow()
      modeTotal.value = 0
      currentContentFilter = options?.contentFilter ?? 'any'

      if (mode === 'recents') {
        const items = await fetchRecents(currentContentFilter)
        const reviewable = items.filter(isReviewable)
        pendingAssets.value = reviewable
        modeTotal.value = reviewable.length
      } else if (mode === 'month' && options?.year && options?.month) {
        const items = await fetchByMonth(options.year, options.month, currentContentFilter)
        const reviewable = items.filter(isReviewable)
        pendingAssets.value = reviewable
        modeTotal.value = reviewable.length
      } else if (mode === 'on-this-day') {
        const items = await fetchMemoryAssets(currentContentFilter)
        const reviewable = items.filter(isReviewable)
        pendingAssets.value = reviewable
        modeTotal.value = reviewable.length
      } else {
        // random — paginate and shuffle batches
        const { items, nextPageToken } = await fetchMediaItemsPage(undefined, currentContentFilter)
        pageToken = nextPageToken
        hasMorePages = !!nextPageToken
        pendingAssets.value = shuffle(items)
      }

      await loadNextAsset()
      if (currentAsset.value) {
        preloadNextAsset()
      } else if (!error.value) {
        error.value = 'No photos to review!'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load photos'
    } finally {
      uiStore.setLoading(false)
    }
  }

  async function keepPhoto(): Promise<void> {
    if (!currentAsset.value) return
    const asset = currentAsset.value
    actionHistory.value.push({ asset, type: 'keep' })
    reviewedStore.markReviewed(asset.id, 'keep')
    uiStore.incrementKept()
    uiStore.toast('Photo kept ✓', 'success', 1500)
    moveToNextAsset()
  }

  async function keepPhotoToAlbum(album: GoogleAlbum): Promise<void> {
    if (!currentAsset.value) return
    const asset = currentAsset.value
    try {
      await addToAlbum(album.id, asset.id)
      preferencesStore.setLastUsedAlbumId(album.id)
      actionHistory.value.push({ asset, type: 'keepToAlbum', albumId: album.id, albumName: album.albumName })
      reviewedStore.markReviewed(asset.id, 'keep')
      uiStore.incrementKept()
      uiStore.toast(`Added to ${album.albumName}`, 'success', 1800)
      moveToNextAsset()
    } catch (e) {
      console.error('Failed to add to album:', e)
      uiStore.toast('Failed to add to album', 'error')
    }
  }

  async function deletePhoto(): Promise<void> {
    if (!currentAsset.value) return
    const asset = currentAsset.value

    try {
      const albumId = await getOrCreateToDeleteAlbum()
      await addToAlbum(albumId, asset.id)
    } catch (e) {
      console.error('Failed to add to To Delete album:', e)
      uiStore.toast('Failed to mark for deletion', 'error')
      return
    }

    actionHistory.value.push({ asset, type: 'delete' })
    reviewedStore.markReviewed(asset.id, 'delete')
    uiStore.incrementDeleted()
    uiStore.toast('Added to "To Delete" album', 'info', 1500)
    moveToNextAsset()
  }

  async function undoLastAction(): Promise<void> {
    const lastAction = actionHistory.value.pop()
    if (!lastAction) {
      uiStore.toast('Nothing to undo', 'info', 1500)
      return
    }

    const resumeAfterUndo = currentAsset.value
    const preloadedAfterResume = nextAsset.value

    if (lastAction.type === 'delete') {
      reviewedStore.unmarkReviewed(lastAction.asset.id)
      uiStore.decrementDeleted()
      uiStore.toast(`${lastAction.asset.filename} restored for review`, 'success', 2500)
    } else {
      reviewedStore.unmarkReviewed(lastAction.asset.id)
      uiStore.decrementKept()
      if (lastAction.type === 'keepToAlbum' && lastAction.albumName) {
        uiStore.toast(`Back to photo (in ${lastAction.albumName})`, 'info', 2000)
      } else {
        uiStore.toast('Back to previous photo', 'info', 1500)
      }
    }

    if (preloadedAfterResume?.id !== resumeAfterUndo?.id) {
      enqueuePendingAsset(preloadedAfterResume)
    }
    setCurrentWithFallback(lastAction.asset, resumeAfterUndo)
  }

  const canUndo = computed(() => actionHistory.value.length > 0)

  return {
    currentAsset,
    nextAsset,
    error,
    modeTotal,
    canUndo,
    loadMode,
    keepPhoto,
    keepPhotoToAlbum,
    deletePhoto,
    undoLastAction,
    fetchAlbums,
    fetchTimeBuckets,
    fetchMemoryAssets,
    getThumbnailUrl,
    getVideoUrl,
    isVideo,
    getAuthHeaders,
  }
}
