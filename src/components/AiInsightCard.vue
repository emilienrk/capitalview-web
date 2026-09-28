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
    const response = await apiClient.get<{ title?: string; text?: string } | string>('/dashboard/card')
    // Anything but text stays hidden: raw JSON is not an insight.
    if (typeof response === 'string') {
      insightBody.value = response
    } else if (response?.text) {
      insightBody.value = response.text
      if (response.title) insightTitle.value = response.title
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
  <div v-if="isVisible && !isLoading && !fetchError && insightBody">
    <BaseCard class="border-primary/20 dark:border-primary/30 shadow-sm relative overflow-hidden">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-primary">
            <Sparkles class="w-4 h-4" aria-hidden="true" />
            <h3 class="font-semibold text-base text-text-main dark:text-text-dark-main">
              {{ insightTitle }}
            </h3>
          </div>
          <button
            @click="closeCard"
            class="p-1 rounded-secondary text-text-muted hover:text-text-main hover:bg-surface-border dark:text-text-dark-muted dark:hover:text-text-dark-main dark:hover:bg-surface-dark-border transition-colors"
            title="Fermer pour aujourd'hui"
            aria-label="Fermer l'aperçu pour aujourd'hui"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </template>

      <div class="leading-relaxed">
        <div class="text-sm text-text-body dark:text-text-dark-muted whitespace-pre-wrap">
          {{ insightBody }}
        </div>
      </div>
    </BaseCard>
  </div>
</template>