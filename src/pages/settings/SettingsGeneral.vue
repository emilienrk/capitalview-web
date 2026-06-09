<script setup lang="ts">
import { FileText, User, Sparkles, Trash2 } from 'lucide-vue-next'

import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFormatters } from '@/composables/useFormatters'
import { BaseCard } from '@/components'
import { ref } from 'vue'

const auth = useAuthStore()
const settingsStore = useSettingsStore()
const { isDark, toggleDarkMode } = useDarkMode()
const { formatDateTime, formatDate } = useFormatters()

const savingIa = ref(false)
const savingKeys = ref(false)
const keysSuccessMessage = ref('')

const claudeApiKey = ref('')
const deepseekApiKey = ref('')
const geminiApiKey = ref('')

async function toggleIaFeature() {
  if (!settingsStore.settings) return
  savingIa.value = true
  const newValue = !settingsStore.settings.ai_feature_enabled
  const success = await settingsStore.updateSettings({
    ai_feature_enabled: newValue
  })
  
  if (success && settingsStore.settings) {
    settingsStore.settings.ai_feature_enabled = newValue
  }
  
  savingIa.value = false
}

async function saveApiKeys() {
  if (!settingsStore.settings) return
  savingKeys.value = true
  keysSuccessMessage.value = ''
  
  const updatePayload: any = {}
  if (claudeApiKey.value.trim()) {
    updatePayload.claude_api_key = claudeApiKey.value.trim()
  }
  if (deepseekApiKey.value.trim()) {
    updatePayload.deepseek_api_key = deepseekApiKey.value.trim()
  }
  if (geminiApiKey.value.trim()) {
    updatePayload.gemini_api_key = geminiApiKey.value.trim()
  }
  
  if (Object.keys(updatePayload).length === 0) {
    savingKeys.value = false
    return
  }
  
  const success = await settingsStore.updateSettings(updatePayload)
  if (success) {
    keysSuccessMessage.value = 'Clés API enregistrées avec succès.'
    claudeApiKey.value = ''
    deepseekApiKey.value = ''
    geminiApiKey.value = ''
    setTimeout(() => {
      keysSuccessMessage.value = ''
    }, 4000)
  }
  savingKeys.value = false
}

async function clearApiKey(provider: 'claude' | 'deepseek' | 'gemini') {
  if (!settingsStore.settings) return
  
  const confirmed = confirm(
    `Êtes-vous sûr de vouloir supprimer la clé API ${
      provider === 'claude' ? 'Claude' : provider === 'deepseek' ? 'DeepSeek' : 'Gemini'
    } ?`
  )
  if (!confirmed) return

  savingKeys.value = true
  const updatePayload: any = {}
  updatePayload[`${provider}_api_key`] = ''
  
  const success = await settingsStore.updateSettings(updatePayload)
  if (success) {
    keysSuccessMessage.value = `Clé API ${
      provider === 'claude' ? 'Claude' : provider === 'deepseek' ? 'DeepSeek' : 'Gemini'
    } supprimée.`
    setTimeout(() => {
      keysSuccessMessage.value = ''
    }, 4000)
  }
  savingKeys.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Profile -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <User class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Compte</h3>
        </div>
      </template>
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span class="text-primary text-2xl font-bold">
              {{ auth.user?.username?.charAt(0).toUpperCase() ?? '?' }}
            </span>
          </div>
          <div>
            <p class="text-lg font-semibold text-text-main dark:text-text-dark-main">
              {{ auth.user?.username }}
            </p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">
              {{ auth.user?.email }}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-surface-border dark:border-surface-dark-border">
          <div>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">Dernière connexion</p>
            <p class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ formatDateTime(auth.user?.last_login) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-muted dark:text-text-dark-muted">Membre depuis</p>
            <p class="text-sm font-medium text-text-main dark:text-text-dark-main">
              {{ formatDate(auth.user?.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- Appearance -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <FileText class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Apparence</h3>
        </div>
      </template>
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-text-main dark:text-text-dark-main">Thème sombre</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Basculer entre le mode clair et sombre
          </p>
        </div>
        <button
          @click="toggleDarkMode"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            isDark ? 'bg-primary' : 'bg-surface-border dark:bg-surface-dark-border',
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
              isDark ? 'translate-x-6' : 'translate-x-1',
            ]"
          />
        </button>
      </div>
    </BaseCard>

    <!-- AI Features -->
    <BaseCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles class="w-4 h-4 text-primary" stroke-width="2" />
            </div>
            <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Fonctionnalité IA</h3>
          </div>
        </div>
      </template>
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-text-main dark:text-text-dark-main">Aperçu quotidien par l'IA</p>
          <p class="text-sm text-text-muted dark:text-text-dark-muted">
            Permet de générer une description IA basée sur votre portefeuille (visible sur la page d'accueil)
          </p>
        </div>
        <button
          @click="toggleIaFeature"
          :disabled="savingIa"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            settingsStore.settings?.ai_feature_enabled ? 'bg-primary' : 'bg-surface-border dark:bg-surface-dark-border',
            savingIa ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
              settingsStore.settings?.ai_feature_enabled ? 'translate-x-6' : 'translate-x-1',
            ]"
          />
        </button>
      </div>
      <div v-if="settingsStore.error" class="mt-4 p-3 bg-danger/10 text-danger rounded-secondary text-sm">
        {{ settingsStore.error }}
      </div>

      <!-- AI API Keys Form -->
      <div v-if="settingsStore.settings?.ai_feature_enabled" class="mt-6 pt-6 border-t border-surface-border dark:border-surface-dark-border space-y-4 animate-fade-in">
        <h4 class="text-sm font-semibold text-text-main dark:text-text-dark-main">
          Configuration des clés API privées
        </h4>
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          Vos clés API sont chiffrées de bout en bout avec votre clé maîtresse (Master Key) avant d'être stockées de manière sécurisée dans la base de données.
        </p>

        <div class="space-y-4">
          <!-- Claude Key -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Clé API Claude (Anthropic)</label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  type="password"
                  v-model="claudeApiKey"
                  :placeholder="settingsStore.settings?.has_claude_api_key ? '•••••••••••••••• (Clé configurée)' : 'sk-ant-api03-...'"
                  class="w-full px-3 py-2 text-sm rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface-bg dark:bg-surface-dark-bg text-text-main dark:text-text-dark-main focus:outline-none focus:border-primary placeholder:text-text-muted/60"
                />
              </div>
              <button
                v-if="settingsStore.settings?.has_claude_api_key"
                type="button"
                @click="clearApiKey('claude')"
                :disabled="savingKeys"
                class="px-3 py-2 text-sm rounded-secondary border border-danger/25 text-danger bg-danger/5 hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Supprimer la clé"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- DeepSeek Key -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Clé API DeepSeek</label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  type="password"
                  v-model="deepseekApiKey"
                  :placeholder="settingsStore.settings?.has_deepseek_api_key ? '•••••••••••••••• (Clé configurée)' : 'sk-...'"
                  class="w-full px-3 py-2 text-sm rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface-bg dark:bg-surface-dark-bg text-text-main dark:text-text-dark-main focus:outline-none focus:border-primary placeholder:text-text-muted/60"
                />
              </div>
              <button
                v-if="settingsStore.settings?.has_deepseek_api_key"
                type="button"
                @click="clearApiKey('deepseek')"
                :disabled="savingKeys"
                class="px-3 py-2 text-sm rounded-secondary border border-danger/25 text-danger bg-danger/5 hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Supprimer la clé"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Gemini Key -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Clé API Gemini (Google)</label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  type="password"
                  v-model="geminiApiKey"
                  :placeholder="settingsStore.settings?.has_gemini_api_key ? '•••••••••••••••• (Clé configurée)' : 'AIzaSy...'"
                  class="w-full px-3 py-2 text-sm rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface-bg dark:bg-surface-dark-bg text-text-main dark:text-text-dark-main focus:outline-none focus:border-primary placeholder:text-text-muted/60"
                />
              </div>
              <button
                v-if="settingsStore.settings?.has_gemini_api_key"
                type="button"
                @click="clearApiKey('gemini')"
                :disabled="savingKeys"
                class="px-3 py-2 text-sm rounded-secondary border border-danger/25 text-danger bg-danger/5 hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Supprimer la clé"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2">
          <button
            type="button"
            @click="saveApiKeys"
            :disabled="savingKeys || (!claudeApiKey && !deepseekApiKey && !geminiApiKey)"
            class="px-4 py-2 text-sm font-medium rounded-secondary bg-primary hover:bg-primary/95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
          >
            {{ savingKeys ? 'Enregistrement...' : 'Enregistrer les clés' }}
          </button>
          
          <span v-if="keysSuccessMessage" class="text-xs text-success font-medium">
            {{ keysSuccessMessage }}
          </span>
        </div>
      </div>
    </BaseCard>

  </div>
</template>
