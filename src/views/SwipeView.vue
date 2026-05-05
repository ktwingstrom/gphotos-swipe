<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGooglePhotos, type SwipeMode, type ContentFilter } from '@/composables/useGooglePhotos'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
import type { GoogleAlbum } from '@/types/googlePhotos'
import SwipeCard from '@/components/SwipeCard.vue'
import AlbumPicker from '@/components/AlbumPicker.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const preferencesStore = usePreferencesStore()

const {
  currentAsset,
  error,
  modeTotal,
  loadMode,
  keepPhoto,
  keepPhotoToAlbum,
  deletePhoto,
  undoLastAction,
  canUndo,
  fetchAlbums,
} = useGooglePhotos()

const mode = computed(() => (route.query.mode as SwipeMode) || 'random')
const year = computed(() => route.query.year ? Number(route.query.year) : undefined)
const month = computed(() => route.query.month ? Number(route.query.month) : undefined)

const sessionReviewed = ref(0)
const progressPct = computed(() => {
  if (modeTotal.value > 0) return Math.round((sessionReviewed.value / modeTotal.value) * 100)
  return 0
})
const progressLabel = computed(() => {
  if (modeTotal.value > 0) return `${sessionReviewed.value}/${modeTotal.value} · ${progressPct.value}%`
  return `${sessionReviewed.value} reviewed`
})

const timeAgo = computed(() => {
  if (!currentAsset.value) return ''
  const d = new Date(currentAsset.value.mediaMetadata.creationTime)
  const diff = Date.now() - d.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs} sec. ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min. ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr. ago`
  const days = Math.floor(hrs / 24)
  if (days < 365) return `${days} day${days > 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} yr. ago`
})

const showAlbumPicker = ref(false)
const isLoadingAlbums = ref(false)
const albumsError = ref<string | null>(null)
const albums = ref<GoogleAlbum[]>([])

async function ensureAlbumsLoaded() {
  if (albums.value.length > 0) return
  try {
    isLoadingAlbums.value = true
    albumsError.value = null
    albums.value = await fetchAlbums()
  } catch (e) {
    albumsError.value = e instanceof Error ? e.message : 'Failed to load albums'
  } finally {
    isLoadingAlbums.value = false
  }
}

async function openAlbumPicker() {
  await ensureAlbumsLoaded()
  showAlbumPicker.value = true
}

async function handleAlbumSelected(album: GoogleAlbum) {
  await keepPhotoToAlbum(album)
  showAlbumPicker.value = false
  sessionReviewed.value++
  uiStore.recordActivity()
}

function handleAssignHotkey(key: string, albumId: string | null) {
  if (albumId) preferencesStore.setHotkey(key, albumId)
  else preferencesStore.clearHotkey(key)
}

async function handleKeep() {
  await keepPhoto()
  sessionReviewed.value++
  uiStore.recordActivity()
}

async function handleDelete() {
  await deletePhoto()
  sessionReviewed.value++
  uiStore.recordActivity()
}

async function handleShare() {
  if (!currentAsset.value) return
  const url = currentAsset.value.productUrl || ''
  if (!url) return
  try {
    if (navigator.share) {
      await navigator.share({ url })
    } else {
      await navigator.clipboard.writeText(url)
      uiStore.toast('Link copied to clipboard', 'success', 2000)
    }
  } catch {}
}

function handleKeydown(e: KeyboardEvent) {
  const active = document.activeElement as HTMLElement | null
  if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return
  if (showAlbumPicker.value) return

  if (e.key === 'ArrowRight') { e.preventDefault(); handleKeep() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); handleDelete() }
  else if (e.key === 'ArrowUp' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) { e.preventDefault(); undoLastAction() }
  else if (/^[0-9]$/.test(e.key)) {
    const albumId = preferencesStore.albumHotkeys[e.key]
    if (!albumId) { uiStore.toast(`No album for key ${e.key}`, 'info', 2000); return }
    const album = albums.value.find(a => a.id === albumId)
    handleAlbumSelected(album || { id: albumId, albumName: `Album ${e.key}` })
  }
}

function checkCompletion() {
  if (error.value === 'No more photos to review!' && mode.value === 'month' && year.value && month.value) {
    preferencesStore.markMonthComplete(year.value, month.value)
  }
}

onMounted(async () => {
  const cf = preferencesStore.contentFilter !== 'any' ? preferencesStore.contentFilter as ContentFilter : undefined
  await loadMode(mode.value, { year: year.value, month: month.value, contentFilter: cf })
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(error, checkCompletion)
</script>

<template>
  <div class="viewport-fit relative bg-black overflow-hidden flex flex-col">
    <!-- Full screen photo -->
    <div class="absolute inset-0" v-if="currentAsset">
      <SwipeCard
        :asset="currentAsset"
        @keep="handleKeep"
        @delete="handleDelete"
      />
    </div>

    <!-- No photo state -->
    <div v-else-if="!uiStore.isLoading" class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
      <svg class="w-16 h-16 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-white/50 text-base text-center px-8">{{ error || 'No photos found' }}</p>
      <button
        @click="router.push('/')"
        class="px-6 py-3 rounded-2xl bg-white/10 text-white font-semibold active:bg-white/20 transition-colors"
      >
        ← back to menu
      </button>
    </div>

    <!-- Top bar overlay -->
    <div class="absolute top-0 left-0 right-0 safe-area-top z-10 pointer-events-none">
      <div class="flex items-center justify-between px-4 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
        <!-- Back -->
        <button
          @click="router.push('/')"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Center info -->
        <div class="flex flex-col items-center gap-0.5">
          <span class="text-white font-bold text-sm tracking-wide uppercase">{{ timeAgo }}</span>
          <span class="text-white/60 text-xs">{{ progressLabel }}</span>
        </div>

        <!-- Undo -->
        <button
          @click="undoLastAction"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50 transition-colors"
          :class="{ 'opacity-30': !canUndo }"
          :disabled="!canUndo"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Right side action buttons -->
    <div
      v-if="currentAsset"
      class="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-4"
    >
      <!-- Share (Google Photos link) -->
      <button
        @click="handleShare"
        class="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center active:bg-black/60 transition-colors"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>

      <!-- Add to album -->
      <button
        @click="openAlbumPicker"
        class="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center active:bg-black/60 transition-colors"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Bottom controls -->
    <div class="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom">
      <div v-if="currentAsset" class="flex items-center justify-between px-8 py-4 bg-gradient-to-t from-black/60 to-transparent">
        <button
          @click="handleDelete"
          class="font-anton text-2xl tracking-widest text-purple-400 active:text-purple-300 transition-colors"
        >
          DELETE
        </button>
        <button
          @click="handleKeep"
          class="font-anton text-2xl tracking-widest text-green-400 active:text-green-300 transition-colors"
        >
          KEEP
        </button>
      </div>

      <!-- Progress bar -->
      <div v-if="modeTotal > 0" class="w-full h-1 bg-white/10">
        <div
          class="h-full bg-green-400 transition-all duration-300"
          :style="{ width: `${progressPct}%` }"
        ></div>
      </div>
    </div>

    <!-- Album picker -->
    <AlbumPicker
      :open="showAlbumPicker"
      :albums="albums"
      :loading="isLoadingAlbums"
      :error="albumsError"
      :hotkeys="preferencesStore.albumHotkeys"
      @close="showAlbumPicker = false"
      @select="handleAlbumSelected"
      @assign-hotkey="handleAssignHotkey"
    />
  </div>
</template>
