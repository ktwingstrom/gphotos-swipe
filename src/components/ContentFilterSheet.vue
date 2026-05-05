<script setup lang="ts">
import type { ContentFilter } from '@/stores/preferences'

defineEmits<{
  close: []
  select: [filter: ContentFilter]
}>()

const options: { filter: ContentFilter; label: string; gradient: string; icon: string }[] = [
  { filter: 'any',   label: 'anything', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)', icon: '✕' },
  { filter: 'IMAGE', label: 'photos',   gradient: 'linear-gradient(135deg, #a855f7, #6366f1)', icon: '🖼' },
  { filter: 'VIDEO', label: 'videos',   gradient: 'linear-gradient(135deg, #ef4444, #f97316)', icon: '🎬' },
]
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/40" @click="$emit('close')" />

    <!-- Sheet -->
    <div class="relative w-full bg-[#F2B19A] rounded-t-3xl px-5 pt-4 pb-8 safe-area-bottom">
      <!-- Drag handle -->
      <div class="w-10 h-1 bg-black/20 rounded-full mx-auto mb-5"></div>

      <p class="text-center text-base font-semibold text-black/70 mb-5">
        pick what types of content to see in random
      </p>

      <div class="flex flex-col gap-3">
        <button
          v-for="opt in options"
          :key="opt.filter"
          class="w-full h-14 rounded-full flex items-center justify-between px-6 active:opacity-80 transition-opacity"
          :style="{ background: opt.gradient }"
          @click="$emit('select', opt.filter)"
        >
          <span class="font-anton text-2xl text-white">{{ opt.label }}</span>
          <span class="text-xl text-white/80">{{ opt.icon }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
