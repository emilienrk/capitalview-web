<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sparkles, X } from 'lucide-vue-next'
import { apiClient } from '@/api/client'
import { BaseCard } from '@/components'

const STORAGE_KEY = 'ai_insight_closed_date'

const isVisible = ref(true)
const isLoading = ref(true)
const insightTitle = ref<string>('Aperçu IA de la journée')
const insightBody = ref<string>('')
const fetchError = ref(false)

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function checkStorage() {
  const closedDate = localStorage.getItem(STORAGE_KEY)
  if (closedDate === getTodayStr()) {
    isVisible.value = false
  }
}

function closeCard() {
  localStorage.setItem(STORAGE_KEY, getTodayStr())
  isVisible.value = false
}

async function fetchInsight() {
  isLoading.value = true
  fetchError.value = false
  try {
    const response = await apiClient.get<any>('/dashboard/card')
    if (response) {
      if (response.title) {
        insightTitle.value = response.title
      }
      if (response.text) {
        insightBody.value = response.text
      } else if (typeof response === 'string') {
        insightBody.value = response
      } else {
        insightBody.value = JSON.stringify(response)
      }
    }
  } catch (error) {
    console.error('Failed to fetch IA card data:', error)
    fetchError.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  checkStorage()
  if (isVisible.value) {
    fetchInsight()
  }
})
</script>

<template>
  <div v-if="isVisible && !isLoading && !fetchError && insightBody" class="mb-6 relative">
    <div class="absolute inset-0 bg-gradient-to-r from-primary/10 via-info/10 to-primary/10 opacity-50 dark:opacity-20 rounded-card pointer-events-none"></div>
    <BaseCard class="border-primary/20 dark:border-primary/30 shadow-sm relative overflow-hidden backdrop-blur-sm">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-primary">
            <Sparkles class="w-5 h-5 animate-pulse" />
            <h3 class="font-semibold text-lg text-text-main dark:text-text-dark-main">
              {{ insightTitle }}
            </h3>
          </div>
          <button
            @click="closeCard"
            class="p-1 rounded-secondary text-text-muted hover:text-text-main hover:bg-surface-border dark:text-text-dark-muted dark:hover:text-text-dark-main dark:hover:bg-surface-dark-border transition-colors"
            title="Fermer pour aujourd'hui"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </template>

      <div class="min-h-[80px] p-2 leading-relaxed">
        <div class="text-sm sm:text-base text-text-body dark:text-text-dark-muted whitespace-pre-wrap">
          {{ insightBody }}
        </div>
      </div>
    </BaseCard>
  </div>
</template>