<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGoogleAuthStore } from '@/stores/googleAuth'

const route = useRoute()
const authStore = useGoogleAuthStore()

const isLoading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  if (route.query.error === 'auth_failed') {
    errorMessage.value = 'Sign-in failed. Please try again.'
  }
})

async function signIn() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    await authStore.startOAuthFlow()
  } catch {
    errorMessage.value = 'Failed to start sign-in. Please try again.'
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8 bg-[#F2B19A]">
    <div class="w-full max-w-sm flex flex-col items-center gap-8">
      <!-- Title -->
      <div class="text-center">
        <h1 class="font-anton text-5xl italic tracking-tight text-black mb-2">gphotos-swipe</h1>
        <p class="text-black/60 text-base">swipe through your Google Photos</p>
      </div>

      <!-- Sign in button -->
      <div class="w-full flex flex-col items-center gap-4">
        <button
          @click="signIn"
          :disabled="isLoading"
          class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-md font-semibold text-gray-800 text-base active:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <svg v-if="!isLoading" viewBox="0 0 24 24" class="w-5 h-5 flex-shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <svg v-else class="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span>{{ isLoading ? 'Redirecting...' : 'Sign in with Google' }}</span>
        </button>

        <div v-if="errorMessage" class="w-full p-3 rounded-xl bg-red-100 text-red-700 text-sm text-center">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Info -->
      <p class="text-black/40 text-xs text-center leading-relaxed max-w-xs">
        Access is read-only + album creation.<br>
        "Deleted" photos are moved to a "To Delete" album.
      </p>
    </div>
  </div>
</template>
