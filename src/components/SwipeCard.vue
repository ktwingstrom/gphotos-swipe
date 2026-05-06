<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useSwipe } from '@/composables/useSwipe'
import { useAuthStore } from '@/stores/auth'
import type { ImmichAsset } from '@/types/immich'

const props = defineProps<{
  asset: ImmichAsset
}>()

const emit = defineEmits<{
  keep: []
  delete: []
}>()

const authStore = useAuthStore()

const cardRef = ref<HTMLElement | null>(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const imageBlobUrl = ref<string | null>(null)
const videoBlobUrl = ref<string | null>(null)
const videoError = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
let imageAbort: AbortController | null = null
let videoAbort: AbortController | null = null

const isVideo = computed(() => props.asset.type === 'VIDEO')

const { isSwiping, swipeOffset, swipeDirection } = useSwipe(cardRef, {
  threshold: 100,
  onSwipeRight: () => emit('keep'),
  onSwipeLeft: () => emit('delete'),
})

const cardStyle = computed(() => {
  if (!isSwiping.value) {
    return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 0.3s ease-out' }
  }
  const rotation = swipeOffset.value * 0.03
  return { transform: `translateX(${swipeOffset.value}px) rotate(${rotation}deg)`, transition: 'none' }
})

const keepOpacity = computed(() =>
  swipeDirection.value === 'right' ? Math.min(Math.abs(swipeOffset.value) / 80, 1) : 0
)
const deleteOpacity = computed(() =>
  swipeDirection.value === 'left' ? Math.min(Math.abs(swipeOffset.value) / 80, 1) : 0
)

function buildAssetUrl(path: string): string {
  if (!authStore.immichBaseUrl) return ''
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${authStore.immichBaseUrl}${authStore.proxyBaseUrl}/assets/${props.asset.id}/${normalized}`
}

function authHeaders(): Record<string, string> {
  return {
    'x-api-key': authStore.apiKey,
  }
}

function revokeImageBlob() {
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
    imageBlobUrl.value = null
  }
}

function revokeVideoBlob() {
  if (videoBlobUrl.value) {
    URL.revokeObjectURL(videoBlobUrl.value)
    videoBlobUrl.value = null
  }
}

async function fetchImage() {
  imageAbort?.abort()
  imageAbort = new AbortController()
  imageLoaded.value = false
  imageError.value = false
  revokeImageBlob()

  const url = buildAssetUrl('thumbnail?size=preview')
  if (!url) {
    imageError.value = true
    return
  }

  try {
    const resp = await fetch(url, { headers: authHeaders(), signal: imageAbort.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    imageBlobUrl.value = URL.createObjectURL(blob)
    imageLoaded.value = true
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    imageError.value = true
  }
}

async function fetchVideo() {
  videoAbort?.abort()
  videoAbort = new AbortController()
  videoError.value = false
  revokeVideoBlob()

  const url = buildAssetUrl('original')
  if (!url) {
    videoError.value = true
    return
  }

  try {
    const resp = await fetch(url, { headers: authHeaders(), signal: videoAbort.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    videoBlobUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    videoError.value = true
  }
}

function loadAsset() {
  if (isVideo.value) {
    fetchImage() // poster from thumbnail
    fetchVideo()
  } else {
    fetchImage()
  }
}

watch(() => props.asset.id, () => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }
  loadAsset()
}, { immediate: true })

onBeforeUnmount(() => {
  imageAbort?.abort()
  videoAbort?.abort()
  revokeImageBlob()
  revokeVideoBlob()
})
</script>

<template>
  <div
    ref="cardRef"
    class="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden"
    :style="cardStyle"
  >
    <!-- Loading state (image not yet loaded) -->
    <div
      v-if="!imageLoaded && !imageError"
      class="absolute inset-0 bg-zinc-900 flex items-center justify-center"
    >
      <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Image error -->
    <div
      v-if="(!isVideo && imageError) || (isVideo && videoError && !videoBlobUrl)"
      class="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-3 text-white/40"
    >
      <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm">Failed to load</p>
    </div>

    <!-- Image -->
    <img
      v-if="!isVideo && imageBlobUrl"
      :src="imageBlobUrl"
      :alt="asset.originalFileName"
      class="w-full h-full object-contain"
      draggable="false"
    />

    <!-- Video poster while loading, then video -->
    <template v-else-if="isVideo">
      <img
        v-if="imageBlobUrl && !videoBlobUrl"
        :src="imageBlobUrl"
        :alt="asset.originalFileName"
        class="absolute inset-0 w-full h-full object-contain"
        draggable="false"
      />
      <video
        v-if="videoBlobUrl"
        ref="videoRef"
        :src="videoBlobUrl"
        class="absolute inset-0 w-full h-full object-contain"
        playsinline
        webkit-playsinline
        autoplay
        muted
        loop
        controls
        @error="videoError = true"
      />
    </template>

    <!-- KEEP indicator -->
    <div
      class="absolute top-10 right-5 pointer-events-none"
      :style="{ opacity: keepOpacity }"
    >
      <div class="border-4 border-green-400 rounded-xl px-4 py-2 rotate-[12deg]">
        <span class="font-anton text-3xl text-green-400 tracking-widest">KEEP</span>
      </div>
    </div>

    <!-- DELETE indicator -->
    <div
      class="absolute top-10 left-5 pointer-events-none"
      :style="{ opacity: deleteOpacity }"
    >
      <div class="border-4 border-purple-400 rounded-xl px-4 py-2 rotate-[-12deg]">
        <span class="font-anton text-3xl text-purple-400 tracking-widest">DELETE</span>
      </div>
    </div>
  </div>
</template>
