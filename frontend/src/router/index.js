import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', redirect: '/feed' },
  { path: '/login', component: () => import('../views/LoginView.vue') },
  { path: '/register', component: () => import('../views/RegisterView.vue') },
  { path: '/feed', component: () => import('../views/FeedView.vue'), meta: { requiresAuth: true } },
  { path: '/messages', component: () => import('../views/MessagesView.vue'), meta: { requiresAuth: true } },
  { path: '/profile/:id', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/profile/:id/:type', component: () => import('../views/FollowsView.vue'), meta: { requiresAuth: true } },
  { path: '/settings', component: () => import('../views/SettingsView.vue'), meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) return '/login'
})

export default router
