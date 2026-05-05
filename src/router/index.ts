import { createRouter, createWebHistory } from 'vue-router'
import { useGoogleAuthStore } from '@/stores/googleAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'menu',
      component: () => import('@/views/MenuView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/swipe',
      name: 'swipe',
      component: () => import('@/views/SwipeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useGoogleAuthStore()

  // Handle OAuth callback — Google redirects to root with ?code=...
  const code = to.query.code as string | undefined
  if (code) {
    const success = await authStore.handleOAuthCallback(code)
    if (success) {
      next({ path: '/', replace: true })
    } else {
      next({ path: '/login', query: { error: 'auth_failed' }, replace: true })
    }
    return
  }

  if (authStore.isLoggedIn) {
    if (to.path === '/login') {
      next('/')
    } else {
      next()
    }
    return
  }

  if (to.meta.requiresAuth) {
    next('/login')
    return
  }

  next()
})

export default router
