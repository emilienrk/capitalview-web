import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './style.css'

import router from './router'
import App from './App.vue'

// Prevent pinch-zoom on iOS (native app feel)
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('touchmove', (e: TouchEvent) => {
  if (e.touches.length > 1) e.preventDefault()
}, { passive: false })

// Umami analytics: production builds only, so dev sessions and self-hosted
// instances built in dev mode don't ping the public stats endpoint.
if (import.meta.env.PROD) {
  const analytics = document.createElement('script')
  analytics.defer = true
  analytics.src = 'https://stats.capitalview.fr/script.js'
  analytics.dataset.websiteId = 'f37ecaa9-ddf8-41c6-bc17-32d4336eebb9'
  document.head.appendChild(analytics)
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
