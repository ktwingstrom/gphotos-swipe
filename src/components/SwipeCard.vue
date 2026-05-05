<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSwipe } from '@/composables/useSwipe'
import type { GoogleMediaItem } from '@/types/googlePhotos'

const props = defineProps<{
  asset: GoogleMediaItem
}>()

const emit = defineEmits<{
  keep: []
  delete: []
}>()

const cardRef = ref<HTMLElement | null>(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const videoError = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)

const { isSwiping, swipeOffset, swipeDirection } = useSwipe(cardRef, {
  threshold: 100,
  onSwipeRight: () => emit('delete'),
  onSwipeLeft: () => emit('keep'),
})

const cardStyle = computed(() => {
  if (!isSwiping.value) {
    return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 0.3s ease-out' }
  }
  const rotation = swipeOffset.value * 0.03
  return { transform: `translateX(${swipeOffset.value}px) rotate(${rotation}deg)`, transition: 'none' }
})

const keepOpacity = computed(() =>
  swipeDirection.value === 'left' ? Math.min(Math.abs(swipeOffset.value) / 80, 1) : 0
)
const deleteOpacity = computed(() =>
  swipeDirection.value === 'right' ? Math.min(Math.abs(swipeOffset.value) / 80, 1) : 0
)

const isVideo = computed(() => props.asset.mimeType.startsWith('video/'))

const imageUrl = computed(() => `${props.asset.baseUrl}=w2000-h2000`)
const videoThumbUrl = computed(() => `${props.asset.baseUrl}=w800-h800`)
const videoSrc = computed(() => `${props.asset.baseUrl}=dv`)

watch(() => props.asset.id, () => {
  imageLoaded.value = false
  imageError.value = false
  videoError.value = false
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }
}, { immediate: false })
</script>

<template>
  <div
    ref="cardRef"
    class="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden"
    :style="cardStyle"
  >
    <!-- Loading state (image not yet loaded) -->
    <div
      v-if="!isVideo && !imageLoaded && !imageError"
      class="absolute inset-0 bg-zinc-900 flex items-center justify-center"
    >
      <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Image error -->
    <div
      v-if="(!isVideo && imageError) || (isVideo && videoError)"
      class="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-3 text-white/40"
    >
      <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm">Failed to load</p>
    </div>

    <!-- Image -->
    <img
      v-if="!isVideo"
      :src="imageUrl"
      :alt="asset.filename"
      class="w-full h-full object-contain"
      :class="{ 'opacity-0': !imageLoaded && !imageError }"
      draggable="false"
      @load="imageLoaded = true"
      @error="imageError = true"
    />

    <!-- Video poster while loading, then video -->
    <template v-else>
      <img
        v-if="!videoError"
        :src="videoThumbUrl"
        :alt="asset.filename"
        class="absolute inset-0 w-full h-full object-contain"
        draggable="false"
      />
      <video
        ref="videoRef"
        :src="videoSrc"
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
      class="absolute top-10 left-5 pointer-events-none"
      :style="{ opacity: keepOpacity }"
    >
      <div class="border-4 border-green-400 rounded-xl px-4 py-2 rotate-[-12deg]">
        <span class="font-anton text-3xl text-green-400 tracking-widest">KEEP</span>
      </div>
    </div>

    <!-- DELETE indicator -->
    <div
      class="absolute top-10 left-5 pointer-events-none"
      :style="{ opacity: deleteOpacity }"
    >
      <div class="border-4 border-purple-400 rounded-xl px-4 py-2 rotate-[12deg]">
        <span class="font-anton text-3xl text-purple-400 tracking-widest">DELETE</span>
      </div>
    </div>
  </div>
</template>
