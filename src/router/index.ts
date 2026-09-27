import { createRouter, createWebHistory, type RouteLocationGeneric } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinAppearance } from '@/theme/appearance'

import Landing from '@/pages/Landing.vue'
import Login from '@/pages/Login.vue'

const Dashboard = () => import('@/pages/Dashboard.vue')
const Stock = () => import('@/pages/Stock.vue')
const Placements = () => import('@/pages/Placements.vue')
const Cashflow = () => import('@/pages/Cashflow.vue')
const BankSection = () => import('@/pages/BankSection.vue')
const Bank = () => import('@/pages/Bank.vue')
const BankTransactions = () => import('@/pages/BankTransactions.vue')
const BankReview = () => import('@/pages/BankReview.vue')
const BankRecurring = () => import('@/pages/BankRecurring.vue')
const Wealth = () => import('@/pages/Asset.vue')
const Crypto = () => import('@/pages/Crypto.vue')
const Notes = () => import('@/pages/Notes.vue')
const Settings = () => import('@/pages/Settings.vue')
const Register = () => import('@/pages/Register.vue')
const Recover = () => import('@/pages/Recover.vue')
const LegalNotice = () => import('@/pages/LegalNotice.vue')
const Privacy = () => import('@/pages/Privacy.vue')
const Community = () => import('@/pages/Community.vue')
const Analysis = () => import('@/pages/Analysis.vue')

const routes = [
  {
    path: '/',
    name: 'landing',
    component: Landing,
    meta: { requiresAuth: false, layout: 'blank' },
  },
  {
    path: '/landing',
    redirect: '/',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false, layout: 'blank' },
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
    meta: { requiresAuth: false, layout: 'blank' },
  },
  {
    path: '/recover',
    name: 'recover',
    component: Recover,
    meta: { requiresAuth: false, layout: 'blank' },
  },
  {
    path: '/mentions-legales',
    name: 'legal-notice',
    component: LegalNotice,
    meta: { requiresAuth: false, layout: 'blank', legal: true },
  },
  {
    path: '/confidentialite',
    name: 'privacy',
    component: Privacy,
    meta: { requiresAuth: false, layout: 'blank', legal: true },
  },
  {
    // One shell for the Banque section's tabs: its header and actions stay put
    // while the tab content under them changes.
    path: '/bank',
    component: BankSection,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'bank', component: Bank },
      { path: 'review', name: 'bank-review', component: BankReview },
      { path: 'transactions', name: 'bank-transactions', component: BankTransactions },
      { path: 'recurring', name: 'bank-recurring', component: BankRecurring },
    ],
  },
  {
    path: '/cashflow',
    name: 'cashflow',
    component: Cashflow,
    meta: { requiresAuth: true },
  },
  {
    path: '/stock',
    name: 'stock',
    component: Stock,
    meta: { requiresAuth: true },
  },
  {
    path: '/placements',
    name: 'placements',
    component: Placements,
    meta: { requiresAuth: true },
  },

  {
    path: '/wealth',
    name: 'wealth',
    component: Wealth,
    meta: { requiresAuth: true },
  },
  {
    path: '/crypto',
    name: 'crypto',
    component: Crypto,
    meta: { requiresAuth: true },
  },
  {
    path: '/notes',
    name: 'notes',
    component: Notes,
    meta: { requiresAuth: true },
  },
  {
    path: '/analyse',
    name: 'analysis',
    component: Analysis,
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    meta: { requiresAuth: true },
  },
  {
    // Where the bank sends the user back: the redirect URL declared in the
    // Enable Banking portal cannot carry a query string, so the path is fixed
    // and only the API's own `?bank_session=` rides along here.
    path: '/settings/banking',
    redirect: (to: RouteLocationGeneric) => ({ name: 'settings', query: { ...to.query, tab: 'banque' } }),
  },
  {
    path: '/community',
    name: 'community',
    component: Community,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Without this, a new page opens at the previous page's scroll offset.
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    if (to.path !== from.path) return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.isInitialized) {
    await auth.checkAuth()
  }

  if (to.name === 'landing' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if ((to.name === 'login' || to.name === 'register' || to.name === 'recover') && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

/** Logged-out pages are reading pages: they keep pinch-zoom, which the app blocks. */
export function isPublicRoute(): boolean {
  return router.currentRoute.value.meta.requiresAuth === false
}

const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
const appViewport = viewport?.content ?? ''
const publicViewport = appViewport.replace(/,\s*(maximum-scale|user-scalable)=[^,]*/g, '')

// Logged-out pages share one fixed look, so the landing and the sign-up form
// match and never inherit a previous user's style (see pinAppearance).
let restoreAppearance: (() => void) | null = null
router.afterEach((to) => {
  const isPublic = to.meta.requiresAuth === false
  if (viewport) viewport.content = isPublic ? publicViewport : appViewport
  if (isPublic) {
    restoreAppearance ??= pinAppearance('editorial', 'prune')
  } else if (restoreAppearance) {
    restoreAppearance()
    restoreAppearance = null
  }
})

export default router
