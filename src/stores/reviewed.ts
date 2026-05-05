import { defineStore } from 'pinia'
import { ref } from 'vue'

type ReviewDecision = 'keep' | 'delete'

interface ReviewedPayload {
  v: 1
  kept: string[]
  deleted: string[]
}

const STORAGE_KEY = 'gphotos-swipe-reviewed'
const STORAGE_VERSION = 1

export const useReviewedStore = defineStore('reviewed', () => {
  const kept = ref<Set<string>>(new Set())
  const deleted = ref<Set<string>>(new Set())
  const initialized = ref(false)

  function loadFromStorage() {
    initialized.value = false
    kept.value = new Set()
    deleted.value = new Set()

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      initialized.value = true
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ReviewedPayload>
      const keptIds = Array.isArray(parsed.kept) ? parsed.kept : []
      const deletedIds = Array.isArray(parsed.deleted) ? parsed.deleted : []
      kept.value = new Set(keptIds.filter((id) => typeof id === 'string'))
      deleted.value = new Set(deletedIds.filter((id) => typeof id === 'string'))
    } catch (e) {
      console.error('Failed to parse reviewed cache from localStorage', e)
    } finally {
      initialized.value = true
    }
  }

  function persist() {
    if (!initialized.value) return
    const payload: ReviewedPayload = {
      v: STORAGE_VERSION,
      kept: Array.from(kept.value),
      deleted: Array.from(deleted.value),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function isReviewed(id: string): boolean {
    return kept.value.has(id) || deleted.value.has(id)
  }

  function getDecision(id: string): ReviewDecision | null {
    if (kept.value.has(id)) return 'keep'
    if (deleted.value.has(id)) return 'delete'
    return null
  }

  function markReviewed(id: string, decision: ReviewDecision) {
    if (!id) return
    if (decision === 'keep') {
      kept.value.add(id)
      deleted.value.delete(id)
    } else {
      deleted.value.add(id)
      kept.value.delete(id)
    }
    persist()
  }

  function unmarkReviewed(id: string) {
    if (!id) return
    kept.value.delete(id)
    deleted.value.delete(id)
    persist()
  }

  function resetReviewed() {
    localStorage.removeItem(STORAGE_KEY)
    loadFromStorage()
  }

  loadFromStorage()

  return {
    isReviewed,
    getDecision,
    markReviewed,
    unmarkReviewed,
    resetReviewed,
  }
})
