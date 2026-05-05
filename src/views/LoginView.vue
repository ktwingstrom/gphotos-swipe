<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useImmich } from '@/composables/useImmich'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { testConnection } = useImmich()

const serverUrl = ref('')
const apiKey = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  const stored = authStore.getStoredConfig()
  if (stored) {
    serverUrl.value = stored.serverUrl
    apiKey.value = stored.apiKey
  }
})

async function signIn() {
  if (!serverUrl.value.trim() || !apiKey.value.trim()) {
    errorMessage.value = 'Server URL and API key are required.'
    return
  }
  isLoading.value = true
  errorMessage.value = ''

  authStore.setConfig(serverUrl.value.trim(), apiKey.value.trim(), 'You')
  const ok = await testConnection()

  if (ok) {
    uiStore.toast('Connected ✓', 'success')
    router.push('/')
  } else {
    errorMessage.value = 'Connection failed. Check the URL, API key, and CORS.'
    authStore.clearConfig()
  }
  isLoading.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-8 bg-[#F2B19A]">
    <div class="w-full max-w-sm flex flex-col items-center gap-6">
      <div class="text-center">
        <h1 class="font-anton text-5xl italic tracking-tight text-black mb-2">immich-swipe</h1>
        <p class="text-black/60 text-base">swipe through your Immich library</p>
      </div>

      <form class="w-full flex flex-col gap-3" @submit.prevent="signIn">
        <label class="text-xs font-bold uppercase tracking-widest text-black/50">Immich server URL</label>
        <input
          v-model="serverUrl"
          type="url"
          placeholder="https://immich.example.com"
          autocomplete="url"
          class="w-full px-4 py-3 rounded-2xl bg-white/80 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/30"
        />

        <label class="text-xs font-bold uppercase tracking-widest text-black/50 mt-2">API key</label>
        <input
          v-model="apiKey"
          type="password"
          placeholder="immich api key"
          autocomplete="current-password"
          class="w-full px-4 py-3 rounded-2xl bg-white/80 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/30"
        />

        <button
          type="submit"
          :disabled="isLoading"
          class="mt-3 w-full px-6 py-4 rounded-2xl bg-black text-white font-bold tracking-wide active:bg-black/80 transition-colors disabled:opacity-60"
        >
          {{ isLoading ? 'Connecting…' : 'Sign in' }}
        </button>

        <div v-if="errorMessage" class="w-full p-3 rounded-xl bg-red-100 text-red-700 text-sm text-center">
          {{ errorMessage }}
        </div>
      </form>

      <p class="text-black/40 text-xs text-center leading-relaxed max-w-xs">
        Generate an API key in Immich under Account → API Keys.<br>
        Stored locally in this browser. Left-swipe sends photos to Immich's trash (30-day auto-purge).
      </p>
    </div>
  </div>
</template>
