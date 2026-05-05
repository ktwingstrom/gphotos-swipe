<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useImmich } from '@/composables/useImmich'
import { useUiStore } from '@/stores/ui'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import type { TimeBucket } from '@/types/immich'
import ContentFilterSheet from '@/components/ContentFilterSheet.vue'
import StreakCalendar from '@/components/StreakCalendar.vue'
import type { ContentFilter } from '@/stores/preferences'

const router = useRouter()
const { fetchTimeBuckets, fetchMemoryAssets, fetchDuplicates } = useImmich()
const uiStore = useUiStore()
const preferencesStore = usePreferencesStore()
const authStore = useAuthStore()

const buckets = ref<TimeBucket[]>([])
const memoryCount = ref(0)
const duplicateCount = ref(0)
const showContentFilter = ref(false)
const showStreak = ref(false)
const showSettings = ref(false)

const MONTH_COLORS = [
  '#0891B2','#7C3AED','#DC2626','#D97706','#059669',
  '#2563EB','#DB2777','#65A30D','#9333EA','#0D9488',
  '#B45309','#0369A1',
]

interface FeaturedMode {
  id: string
  label: string
  gradient: string
  badge: number | null
  iconPath: string
}

const featuredModes = computed<FeaturedMode[]>(() => [
  {
    id: 'recents',
    label: 'recents',
    gradient: 'linear-gradient(135deg, #0d9488, #1d4ed8)',
    badge: null,
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'random',
    label: 'random',
    gradient: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
    badge: null,
    iconPath: 'M4 4l6 6m6-6l-6 6m-6 6l6-6m6 6l-6-6',
  },
  {
    id: 'on-this-day',
    label: 'on this day',
    gradient: 'linear-gradient(135deg, #f97316, #ec4899)',
    badge: memoryCount.value > 0 ? memoryCount.value : null,
    iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'duplicates',
    label: 'duplicates',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    badge: duplicateCount.value > 0 ? duplicateCount.value : null,
    iconPath: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2',
  },
])

const sortedBuckets = computed(() => {
  const sorted = [...buckets.value]
  if (preferencesStore.monthSortOrder === 'oldest') sorted.reverse()
  if (preferencesStore.hideCompleted) {
    return sorted.filter(b => {
      const d = parseBucket(b)
      return !preferencesStore.isMonthComplete(d.year, d.month)
    })
  }
  return sorted
})

function parseBucket(b: TimeBucket) {
  const d = new Date(b.timeBucket)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function formatBucketLabel(b: TimeBucket): string {
  const d = new Date(b.timeBucket)
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const yr = String(d.getUTCFullYear()).slice(2)
  return `${mon} '${yr}`
}

function isBucketCompleted(b: TimeBucket): boolean {
  const { year, month } = parseBucket(b)
  return preferencesStore.isMonthComplete(year, month)
}

function handleModeClick(mode: FeaturedMode) {
  if (mode.id === 'random') {
    showContentFilter.value = true
    return
  }
  router.push({ path: '/swipe', query: { mode: mode.id } })
}

function handleFilterSelect(filter: ContentFilter) {
  preferencesStore.setContentFilter(filter)
  showContentFilter.value = false
  router.push({ path: '/swipe', query: { mode: 'random' } })
}

function navigateToMonth(b: TimeBucket) {
  const { year, month } = parseBucket(b)
  router.push({ path: '/swipe', query: { mode: 'month', year, month } })
}

function logout() {
  authStore.clearConfig()
  showSettings.value = false
  router.push('/login')
}

onMounted(async () => {
  buckets.value = await fetchTimeBuckets()
  try {
    const mems = await fetchMemoryAssets()
    memoryCount.value = mems.length
  } catch {
    memoryCount.value = 0
  }
  try {
    const groups = await fetchDuplicates()
    duplicateCount.value = groups.reduce((acc, g) => acc + g.assets.length, 0)
  } catch {
    duplicateCount.value = 0
  }
})
</script>

<template>
  <div class="viewport-fit flex flex-col bg-[#F2B19A] overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 safe-area-top flex-shrink-0">
      <h1 class="font-anton text-4xl italic tracking-tight text-black">immich-swipe</h1>
      <div class="flex items-center gap-2">
        <!-- Streak -->
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 active:bg-black/20 transition-colors"
          @click="showStreak = true"
        >
          <svg class="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C9 7 7 9.5 7 12a5 5 0 0010 0c0-2.5-2-5-5-10z" />
          </svg>
          <span class="font-bold text-sm text-black/80">{{ uiStore.streak.currentStreak }}</span>
        </button>
        <!-- Settings -->
        <button
          class="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center active:bg-black/20 transition-colors"
          @click="showSettings = true"
        >
          <svg class="w-5 h-5 text-black/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Featured mode tiles -->
      <div
        v-for="mode in featuredModes"
        :key="mode.id"
        class="w-full h-24 flex items-center justify-between px-5 cursor-pointer active:opacity-85 transition-opacity select-none"
        :style="{ background: mode.gradient }"
        @click="handleModeClick(mode)"
      >
        <span class="font-anton text-4xl text-white">{{ mode.label }}</span>
        <div class="flex items-center gap-3">
          <!-- Badge -->
          <div v-if="mode.badge" class="relative">
            <div class="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center">
              <span class="text-white text-xs font-bold">{{ mode.badge > 99 ? '99+' : mode.badge }}</span>
            </div>
            <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
          </div>
          <!-- Icon -->
          <svg class="w-7 h-7 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="mode.iconPath" />
          </svg>
        </div>
      </div>

      <!-- Month tiles -->
      <div
        v-for="(bucket, index) in sortedBuckets"
        :key="bucket.timeBucket"
        class="w-full h-[5.5rem] flex items-center justify-between px-5 cursor-pointer active:opacity-85 transition-opacity select-none"
        :style="{ backgroundColor: MONTH_COLORS[index % MONTH_COLORS.length] }"
        @click="navigateToMonth(bucket)"
      >
        <span
          class="font-anton text-5xl text-white leading-none"
          :class="{ 'line-through opacity-60': isBucketCompleted(bucket) }"
        >
          {{ formatBucketLabel(bucket) }}
        </span>
        <div class="flex items-center gap-2 text-white/80">
          <span v-if="bucket.count" class="text-sm font-bold">{{ bucket.count }}</span>
          <div v-if="!isBucketCompleted(bucket)" class="text-white/60 text-xl font-bold">▶▶</div>
        </div>
      </div>

      <!-- Bottom padding -->
      <div class="h-6"></div>
    </div>

    <!-- Settings sheet -->
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="showSettings" class="fixed inset-0 z-50 flex items-end">
        <div class="absolute inset-0 bg-black/40" @click="showSettings = false" />
        <div class="relative w-full bg-[#F2B19A] rounded-t-3xl px-5 pt-4 pb-8 safe-area-bottom">
          <div class="w-10 h-1 bg-black/20 rounded-full mx-auto mb-5"></div>

          <!-- Sort order -->
          <p class="font-bold text-sm uppercase tracking-widest text-black/40 mb-2">sort months by</p>
          <div class="flex flex-col gap-1 mb-5">
            <button
              v-for="opt in [{ v: 'recent', l: 'most recent' }, { v: 'oldest', l: 'least recent' }]"
              :key="opt.v"
              class="text-left py-2 text-lg font-semibold transition-colors"
              :class="preferencesStore.monthSortOrder === opt.v ? 'text-black underline underline-offset-4' : 'text-black/40'"
              @click="preferencesStore.setMonthSortOrder(opt.v as 'recent' | 'oldest')"
            >
              {{ opt.l }}
            </button>
          </div>

          <!-- Hide completed -->
          <p class="font-bold text-sm uppercase tracking-widest text-black/40 mb-2">hide completed months</p>
          <div class="flex flex-col gap-1 mb-6">
            <button
              v-for="opt in [{ v: false, l: 'no' }, { v: true, l: 'yes' }]"
              :key="String(opt.v)"
              class="text-left py-2 text-lg font-semibold transition-colors"
              :class="preferencesStore.hideCompleted === opt.v ? 'text-black underline underline-offset-4' : 'text-black/40'"
              @click="preferencesStore.setHideCompleted(opt.v)"
            >
              {{ opt.l }}
            </button>
          </div>

          <!-- Logout -->
          <button
            class="w-full py-3 rounded-2xl bg-black/10 text-black font-semibold text-base active:bg-black/20 transition-colors"
            @click="logout"
          >
            log out
          </button>
        </div>
      </div>
    </Transition>

    <!-- Content filter sheet (random mode) -->
    <ContentFilterSheet
      v-if="showContentFilter"
      @close="showContentFilter = false"
      @select="handleFilterSelect"
    />

    <!-- Streak calendar -->
    <StreakCalendar v-if="showStreak" @close="showStreak = false" />
  </div>
</template>
