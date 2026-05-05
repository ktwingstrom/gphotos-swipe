import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    {
      path: '/select-user',
      name: 'select-user',
      component: () => import('@/views/UserSelectView.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (authStore.isLoggedIn) {
    if (to.path === '/login' || to.path === '/select-user') {
      next('/')
    } else {
      next()
    }
    return
  }

  if (to.path === '/login') {
    if (authStore.hasEnvConfig) {
      if (authStore.hasSingleEnvUser) {
        authStore.autoLoginSingleUser()
        next('/')
      } else {
        next('/select-user')
      }
    } else {
      next()
    }
    return
  }

  if (to.path === '/select-user') {
    if (!authStore.hasEnvConfig) {
      next('/login')
    } else if (authStore.hasSingleEnvUser) {
      authStore.autoLoginSingleUser()
      next('/')
    } else {
      next()
    }
    return
  }

  if (to.meta.requiresAuth) {
    if (authStore.hasEnvConfig) {
      if (authStore.hasSingleEnvUser) {
        authStore.autoLoginSingleUser()
        next()
      } else {
        next('/select-user')
      }
    } else {
      next('/login')
    }
    return
  }

  next()
})

export default router
