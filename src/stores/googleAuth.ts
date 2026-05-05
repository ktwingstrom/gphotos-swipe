import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
].join(' ')

const STORAGE_KEY = 'gphotos-swipe-auth'

interface StoredAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const useGoogleAuthStore = defineStore('googleAuth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const expiresAt = ref<number | null>(null)

  function loadStoredAuth() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const auth: StoredAuth = JSON.parse(stored)
      accessToken.value = auth.accessToken
      refreshToken.value = auth.refreshToken
      expiresAt.value = auth.expiresAt
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function saveAuth(tokens: StoredAuth) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    expiresAt.value = tokens.expiresAt
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  }

  function clearAuth() {
    accessToken.value = null
    refreshToken.value = null
    expiresAt.value = null
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem('gphotos-pkce-verifier')
  }

  const isLoggedIn = computed(() => !!accessToken.value && !!refreshToken.value)

  const isTokenExpired = computed(() => {
    if (!expiresAt.value) return true
    return Date.now() >= expiresAt.value - 60_000
  })

  async function startOAuthFlow() {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    sessionStorage.setItem('gphotos-pkce-verifier', verifier)

    const redirectUri = window.location.origin
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  async function handleOAuthCallback(code: string): Promise<boolean> {
    const verifier = sessionStorage.getItem('gphotos-pkce-verifier')
    if (!verifier) {
      console.error('No PKCE verifier found in sessionStorage')
      return false
    }

    const redirectUri = window.location.origin
    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    })

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        console.error('Token exchange failed:', await response.text())
        return false
      }

      const data = await response.json()
      sessionStorage.removeItem('gphotos-pkce-verifier')

      saveAuth({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      })

      return true
    } catch (e) {
      console.error('OAuth callback error:', e)
      return false
    }
  }

  async function refreshAccessToken(): Promise<boolean> {
    if (!refreshToken.value) return false

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken.value,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        console.error('Token refresh failed:', await response.text())
        clearAuth()
        return false
      }

      const data = await response.json()
      saveAuth({
        accessToken: data.access_token,
        refreshToken: refreshToken.value!,
        expiresAt: Date.now() + data.expires_in * 1000,
      })

      return true
    } catch {
      return false
    }
  }

  async function getValidToken(): Promise<string | null> {
    if (!accessToken.value) return null
    if (isTokenExpired.value) {
      const success = await refreshAccessToken()
      if (!success) return null
    }
    return accessToken.value
  }

  loadStoredAuth()

  return {
    accessToken,
    refreshToken,
    expiresAt,
    isLoggedIn,
    isTokenExpired,
    startOAuthFlow,
    handleOAuthCallback,
    refreshAccessToken,
    getValidToken,
    clearAuth,
  }
})
