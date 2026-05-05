import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

type ReviewOrder = 'random' | 'chronological' | 'chronological-desc'
export type ContentFilter = 'any' | 'IMAGE' | 'VIDEO'
export type MonthSortOrder = 'recent' | 'oldest'

interface StoredPreferences {
  reviewOrder: ReviewOrder
  albumHotkeys: Record<string, string>
  lastUsedAlbumId: string | null
  contentFilter: ContentFilter
  monthSortOrder: MonthSortOrder
  hideCompleted: boolean
  completedMonths: string[]
}

const STORAGE_KEY = 'gphotos-swipe-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  const reviewOrder = ref<ReviewOrder>('random')
  const albumHotkeys = ref<Record<string, string>>({})
  const lastUsedAlbumId = ref<string | null>(null)
  const contentFilter = ref<ContentFilter>('any')
  const monthSortOrder = ref<MonthSortOrder>('recent')
  const hideCompleted = ref<boolean>(false)
  const completedMonths = ref<string[]>([])
  const initialized = ref(false)

  function loadFromStorage() {
    initialized.value = false
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      reviewOrder.value = 'random'
      albumHotkeys.value = {}
      lastUsedAlbumId.value = null
      contentFilter.value = 'any'
      monthSortOrder.value = 'recent'
      hideCompleted.value = false
      completedMonths.value = []
      initialized.value = true
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredPreferences>
      reviewOrder.value = parsed.reviewOrder ?? 'random'
      albumHotkeys.value = parsed.albumHotkeys ?? {}
      lastUsedAlbumId.value = parsed.lastUsedAlbumId ?? null
      contentFilter.value = parsed.contentFilter ?? 'any'
      monthSortOrder.value = parsed.monthSortOrder ?? 'recent'
      hideCompleted.value = parsed.hideCompleted ?? false
      completedMonths.value = parsed.completedMonths ?? []
    } catch (e) {
      console.error('Failed to parse preferences from localStorage', e)
    } finally {
      initialized.value = true
    }
  }

  function persist() {
    if (!initialized.value) return
    const payload: StoredPreferences = {
      reviewOrder: reviewOrder.value,
      albumHotkeys: albumHotkeys.value,
      lastUsedAlbumId: lastUsedAlbumId.value,
      contentFilter: contentFilter.value,
      monthSortOrder: monthSortOrder.value,
      hideCompleted: hideCompleted.value,
      completedMonths: completedMonths.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function setReviewOrder(order: ReviewOrder) {
    reviewOrder.value = order
  }

  function setHotkey(key: string, albumId: string) {
    albumHotkeys.value = { ...albumHotkeys.value, [key]: albumId }
  }

  function clearHotkey(key: string) {
    const { [key]: _, ...rest } = albumHotkeys.value
    albumHotkeys.value = rest
  }

  function setLastUsedAlbumId(albumId: string | null) {
    lastUsedAlbumId.value = albumId
  }

  function setContentFilter(filter: ContentFilter) {
    contentFilter.value = filter
  }

  function setMonthSortOrder(order: MonthSortOrder) {
    monthSortOrder.value = order
  }

  function setHideCompleted(hide: boolean) {
    hideCompleted.value = hide
  }

  function markMonthComplete(year: number, month: number) {
    const key = `${year}-${month}`
    if (!completedMonths.value.includes(key)) {
      completedMonths.value = [...completedMonths.value, key]
    }
  }

  function isMonthComplete(year: number, month: number): boolean {
    return completedMonths.value.includes(`${year}-${month}`)
  }

  loadFromStorage()

  watch(
    [reviewOrder, albumHotkeys, lastUsedAlbumId, contentFilter, monthSortOrder, hideCompleted, completedMonths],
    () => persist(),
    { deep: true }
  )

  return {
    reviewOrder,
    albumHotkeys,
    lastUsedAlbumId,
    contentFilter,
    monthSortOrder,
    hideCompleted,
    completedMonths,
    setReviewOrder,
    setHotkey,
    clearHotkey,
    setLastUsedAlbumId,
    setContentFilter,
    setMonthSortOrder,
    setHideCompleted,
    markMonthComplete,
    isMonthComplete,
  }
})
