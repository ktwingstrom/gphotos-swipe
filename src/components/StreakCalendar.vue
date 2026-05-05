<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/ui'

defineEmits<{ close: [] }>()

const uiStore = useUiStore()

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-indexed

const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
})

const calendarDays = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: Array<{ day: number | null; date: string | null }> = []
  for (let i = 0; i < firstDay; i++) days.push({ day: null, date: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ day: d, date: dateStr })
  }
  return days
})

const todayStr = today.toISOString().slice(0, 10)

function isActive(date: string | null): boolean {
  if (!date) return false
  return uiStore.streak.activeDates.includes(date)
}

function isToday(date: string | null): boolean {
  return date === todayStr
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  const now = new Date()
  if (viewYear.value === now.getFullYear() && viewMonth.value === now.getMonth()) return
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60" @click="$emit('close')" />
    <div class="relative bg-[#C4A882] rounded-3xl w-[90vw] max-w-sm p-6 text-[#3D2B1F]">
      <!-- Streak header -->
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="font-bold text-5xl">{{ uiStore.streak.currentStreak }}</span>
          <p class="text-sm font-semibold opacity-70 mt-0.5">day streak</p>
        </div>
        <svg class="w-14 h-14 opacity-50" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C9 7 7 9.5 7 12a5 5 0 0010 0c0-2.5-2-5-5-10z" />
        </svg>
      </div>

      <!-- Month nav -->
      <div class="flex items-center justify-between mb-3">
        <span class="font-bold text-sm tracking-wide">{{ monthLabel }}</span>
        <div class="flex gap-2">
          <button @click="prevMonth" class="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 text-sm">‹</button>
          <button @click="nextMonth" class="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 text-sm">›</button>
        </div>
      </div>

      <!-- Day-of-week headers -->
      <div class="grid grid-cols-7 mb-1">
        <div v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d"
          class="text-center text-xs font-semibold opacity-50 pb-1">{{ d }}</div>
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 gap-y-1">
        <div
          v-for="(cell, i) in calendarDays"
          :key="i"
          class="flex items-center justify-center h-9"
        >
          <div
            v-if="cell.day !== null"
            class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors"
            :class="{
              'bg-[#3D2B1F] text-[#C4A882]': isToday(cell.date),
              'bg-[#3D2B1F]/30': isActive(cell.date) && !isToday(cell.date),
              'opacity-40': !isActive(cell.date) && !isToday(cell.date),
            }"
          >
            {{ cell.day }}
          </div>
        </div>
      </div>

      <!-- Best streak -->
      <p class="text-center text-sm font-semibold opacity-60 mt-4">
        Best Streak: {{ uiStore.streak.bestStreak }} days
      </p>
    </div>
  </div>
</template>
