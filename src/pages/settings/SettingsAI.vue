<script setup lang="ts">
import { Sparkles, Trash2, Eye, MessageSquare, ChevronDown, Check } from 'lucide-vue-next'
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { apiClient } from '@/api/client'
import { BaseCard, BaseButton, BaseAlert, BaseSkeleton } from '@/components'
import type { AIOptionsResponse, AIProviderUpdate, AIProviderConfig } from '@/types'

const settingsStore = useSettingsStore()

// --- State ---
const aiOptions = ref<AIOptionsResponse | null>(null)
const isLoadingOptions = ref(false)
const savingProvider = ref<string | null>(null)
const savingPreference = ref<'vision' | 'chat' | null>(null)
const providerError = ref<Record<string, string>>({})
const providerSuccess = ref<Record<string, string>>({})
const apiKeyInputs = ref<Record<string, string>>({})

// --- Computed helpers ---
const settings = computed(() => settingsStore.settings)
const isAiEnabled = computed(() => settings.value?.ai_feature_enabled ?? false)

const configuredProviders = computed<Record<string, AIProviderConfig>>(() => {
  const map: Record<string, AIProviderConfig> = {}
  for (const p of settings.value?.ai_providers ?? []) {
    map[p.provider] = p
  }
  return map
})

const visionOptions = computed(() => aiOptions.value?.capabilities?.vision ?? [])
const chatOptions = computed(() => aiOptions.value?.capabilities?.chat ?? [])

// Providers that have a key configured + support vision
const visionAvailable = computed(() =>
  visionOptions.value.filter(o => o.has_key)
)
const chatAvailable = computed(() =>
  chatOptions.value.filter(o => o.has_key)
)

const hasAnyVisionKey = computed(() => visionAvailable.value.length > 0)
const hasAnyChatKey = computed(() => chatAvailable.value.length > 0)

// Effective provider (explicit preference or auto first available)
const effectiveVisionProvider = computed(() =>
  settings.value?.ai_vision_provider ?? visionAvailable.value[0]?.provider ?? null
)
const effectiveChatProvider = computed(() =>
  settings.value?.ai_chat_provider ?? chatAvailable.value[0]?.provider ?? null
)

// --- Lifecycle ---
onMounted(async () => {
  isLoadingOptions.value = true
  try {
    aiOptions.value = await apiClient.get<AIOptionsResponse>('/settings/ai/options')
  } finally {
    isLoadingOptions.value = false
  }
})

// --- Actions ---
async function toggleAiFeature() {
  if (!settings.value) return
  const newValue = !settings.value.ai_feature_enabled
  await settingsStore.updateSettings({ ai_feature_enabled: newValue })
}

async function saveProviderKey(providerId: string) {
  const key = apiKeyInputs.value[providerId]?.trim()
  savingProvider.value = providerId
  delete providerError.value[providerId]
  delete providerSuccess.value[providerId]

  try {
    const payload: AIProviderUpdate = { api_key: key || null }
    const result = await apiClient.put<AIProviderConfig>(
      `/settings/ai/providers/${providerId}`, payload
    )
    // Update local state
    const existing = settings.value?.ai_providers?.find(p => p.provider === providerId)
    if (existing) {
      existing.has_key = result.has_key
      existing.selected_model = result.selected_model
    } else if (settings.value) {
      settings.value.ai_providers = [...(settings.value.ai_providers ?? []), result]
    }
    // Refresh options to update has_key flags
    aiOptions.value = await apiClient.get<AIOptionsResponse>('/settings/ai/options')
    apiKeyInputs.value[providerId] = ''
    providerSuccess.value[providerId] = key ? 'Clé enregistrée.' : 'Clé supprimée.'
    setTimeout(() => delete providerSuccess.value[providerId], 3000)
  } catch (e: any) {
    providerError.value[providerId] = e?.message ?? 'Erreur lors de la sauvegarde.'
  } finally {
    savingProvider.value = null
  }
}

async function clearProviderKey(providerId: string) {
  const label = aiOptions.value?.capabilities.vision.find(o => o.provider === providerId)?.label
    ?? aiOptions.value?.capabilities.chat.find(o => o.provider === providerId)?.label
    ?? providerId
  if (!confirm(`Supprimer la clé API ${label} ?`)) return

  savingProvider.value = providerId
  try {
    await apiClient.put<AIProviderConfig>(`/settings/ai/providers/${providerId}`, { api_key: null })
    if (settings.value) {
      const p = settings.value.ai_providers?.find(x => x.provider === providerId)
      if (p) p.has_key = false
    }
    aiOptions.value = await apiClient.get<AIOptionsResponse>('/settings/ai/options')
    providerSuccess.value[providerId] = 'Clé supprimée.'
    setTimeout(() => delete providerSuccess.value[providerId], 3000)
  } catch (e: any) {
    providerError.value[providerId] = e?.message ?? 'Erreur.'
  } finally {
    savingProvider.value = null
  }
}

async function saveModel(providerId: string, modelId: string) {
  savingProvider.value = providerId
  try {
    const result = await apiClient.put<AIProviderConfig>(
      `/settings/ai/providers/${providerId}`, { selected_model: modelId || null }
    )
    const p = settings.value?.ai_providers?.find(x => x.provider === providerId)
    if (p) p.selected_model = result.selected_model
    providerSuccess.value[providerId] = 'Modèle enregistré.'
    setTimeout(() => delete providerSuccess.value[providerId], 3000)
  } catch {
    // silent
  } finally {
    savingProvider.value = null
  }
}

async function setCapabilityProvider(capability: 'vision' | 'chat', providerId: string | null) {
  savingPreference.value = capability
  try {
    await settingsStore.updateSettings(
      capability === 'vision'
        ? { ai_vision_provider: providerId }
        : { ai_chat_provider: providerId }
    )
  } finally {
    savingPreference.value = null
  }
}

// Placeholder text for api key input
function keyPlaceholder(providerId: string): string {
  const prefixes: Record<string, string> = {
    anthropic: 'sk-ant-api03-...',
    google: 'AIzaSy...',
    deepseek: 'sk-...',
  }
  return configuredProviders.value[providerId]?.has_key
    ? '•••••••••••••••• (Clé configurée)'
    : (prefixes[providerId] ?? 'Clé API...')
}

// All unique providers from options
const allProviders = computed(() => {
  const seen = new Set<string>()
  const result: { provider: string; label: string; models: any[] }[] = []
  for (const cap of ['vision', 'chat'] as const) {
    for (const o of aiOptions.value?.capabilities[cap] ?? []) {
      if (!seen.has(o.provider)) {
        seen.add(o.provider)
        result.push({ provider: o.provider, label: o.label, models: o.models })
      }
    }
  }
  return result
})
</script>

<template>
  <div class="space-y-6">

    <!-- Enable AI toggle -->
    <BaseCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles class="w-4 h-4 text-primary" stroke-width="2" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Intelligence Artificielle</h3>
              <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
                Activez les fonctionnalités IA pour l'import par image et l'analyse de portefeuille
              </p>
            </div>
          </div>
          <button
            @click="toggleAiFeature"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
              isAiEnabled ? 'bg-primary' : 'bg-surface-border dark:bg-surface-dark-border',
            ]"
            :aria-pressed="isAiEnabled"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                isAiEnabled ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
        </div>
      </template>
    </BaseCard>

    <template v-if="isAiEnabled">
      <!-- API Keys & Models per provider -->
      <BaseCard>
        <template #header>
          <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Clés API & Modèles</h3>
          <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
            Vos clés sont chiffrées de bout en bout avec votre Master Key avant d'être stockées.
          </p>
        </template>

        <template v-if="isLoadingOptions">
          <div class="space-y-4">
            <BaseSkeleton v-for="i in 3" :key="i" variant="rect" height="5rem" />
          </div>
        </template>

        <div v-else class="space-y-6">
          <div
            v-for="p in allProviders"
            :key="p.provider"
            class="p-4 rounded-card border border-surface-border dark:border-surface-dark-border space-y-3"
          >
            <!-- Provider header -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-text-main dark:text-text-dark-main">{{ p.label }}</span>
                <span
                  :class="[
                    'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-secondary',
                    configuredProviders[p.provider]?.has_key
                      ? 'bg-success/10 text-success'
                      : 'bg-surface-border dark:bg-surface-dark-border text-text-muted dark:text-text-dark-muted'
                  ]"
                >
                  {{ configuredProviders[p.provider]?.has_key ? 'Configuré' : 'Non configuré' }}
                </span>
              </div>
              <button
                v-if="configuredProviders[p.provider]?.has_key"
                type="button"
                @click="clearProviderKey(p.provider)"
                :disabled="savingProvider === p.provider"
                class="p-1.5 rounded-secondary text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                title="Supprimer la clé"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- API Key input -->
            <div class="flex gap-2">
              <input
                type="password"
                v-model="apiKeyInputs[p.provider]"
                :placeholder="keyPlaceholder(p.provider)"
                class="flex-1 px-3 py-2 text-sm rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface-bg dark:bg-surface-dark-bg text-text-main dark:text-text-dark-main focus:outline-none focus:border-primary placeholder:text-text-muted/60"
              />
              <BaseButton
                size="sm"
                :loading="savingProvider === p.provider"
                :disabled="!apiKeyInputs[p.provider]?.trim()"
                @click="saveProviderKey(p.provider)"
              >
                Enregistrer
              </BaseButton>
            </div>

            <!-- Success / Error feedback -->
            <p v-if="providerSuccess[p.provider]" class="text-xs text-success">{{ providerSuccess[p.provider] }}</p>
            <p v-if="providerError[p.provider]" class="text-xs text-danger">{{ providerError[p.provider] }}</p>

            <!-- Model selector (only if key configured) -->
            <div v-if="configuredProviders[p.provider]?.has_key && p.models.length > 1" class="space-y-1">
              <label class="text-xs font-medium text-text-muted dark:text-text-dark-muted">Modèle</label>
              <select
                :value="configuredProviders[p.provider]?.selected_model ?? ''"
                @change="saveModel(p.provider, ($event.target as HTMLSelectElement).value)"
                class="w-full px-3 py-2 text-sm rounded-secondary border border-surface-border dark:border-surface-dark-border bg-surface-bg dark:bg-surface-dark-bg text-text-main dark:text-text-dark-main focus:outline-none focus:border-primary"
              >
                <option value="">Modèle par défaut</option>
                <option
                  v-for="m in p.models"
                  :key="m.id"
                  :value="m.id"
                >
                  {{ m.label }}{{ m.default ? ' (défaut)' : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Capability preferences -->
      <BaseCard>
        <template #header>
          <h3 class="text-base font-semibold text-text-main dark:text-text-dark-main">Préférences par usage</h3>
          <p class="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
            Choisissez quel provider utiliser pour chaque type de tâche IA.
          </p>
        </template>

        <template v-if="isLoadingOptions">
          <div class="space-y-4">
            <BaseSkeleton v-for="i in 2" :key="i" variant="rect" height="7rem" />
          </div>
        </template>

        <div v-else class="space-y-6">

          <!-- Vision -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4 text-primary" stroke-width="2" />
              <p class="text-sm font-semibold text-text-main dark:text-text-dark-main">Vision (import par image)</p>
            </div>

            <BaseAlert v-if="!hasAnyVisionKey" variant="warning" class="text-xs">
              Configurez une clé API <strong>Google</strong> ou <strong>Anthropic</strong> ci-dessus pour activer l'import par image.
            </BaseAlert>

            <div v-else class="space-y-2">
              <label
                v-for="opt in visionOptions"
                :key="opt.provider"
                :class="[
                  'flex items-center justify-between p-3 rounded-card border-2 cursor-pointer transition-colors',
                  !opt.has_key ? 'opacity-40 cursor-not-allowed border-surface-border dark:border-surface-dark-border' :
                  effectiveVisionProvider === opt.provider
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-surface-border dark:border-surface-dark-border hover:border-primary/40',
                ]"
              >
                <div class="flex items-center gap-3">
                  <input
                    type="radio"
                    name="visionProvider"
                    :value="opt.provider"
                    :checked="effectiveVisionProvider === opt.provider"
                    :disabled="!opt.has_key || savingPreference === 'vision'"
                    @change="setCapabilityProvider('vision', opt.provider)"
                    class="accent-primary"
                  />
                  <div>
                    <p class="text-sm font-medium text-text-main dark:text-text-dark-main">{{ opt.label }}</p>
                    <p v-if="!opt.has_key" class="text-xs text-text-muted dark:text-text-dark-muted">Clé API non configurée</p>
                  </div>
                </div>
                <Check v-if="effectiveVisionProvider === opt.provider && opt.has_key" class="w-4 h-4 text-primary shrink-0" stroke-width="2.5" />
              </label>
            </div>
          </div>

          <div class="border-t border-surface-border dark:border-surface-dark-border" />

          <!-- Chat -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <MessageSquare class="w-4 h-4 text-primary" stroke-width="2" />
              <p class="text-sm font-semibold text-text-main dark:text-text-dark-main">Chat (analyse & messages)</p>
            </div>

            <BaseAlert v-if="!hasAnyChatKey" variant="warning" class="text-xs">
              Configurez au moins une clé API ci-dessus pour activer les fonctionnalités de chat IA.
            </BaseAlert>

            <div v-else class="space-y-2">
              <label
                v-for="opt in chatOptions"
                :key="opt.provider"
                :class="[
                  'flex items-center justify-between p-3 rounded-card border-2 cursor-pointer transition-colors',
                  !opt.has_key ? 'opacity-40 cursor-not-allowed border-surface-border dark:border-surface-dark-border' :
                  effectiveChatProvider === opt.provider
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-surface-border dark:border-surface-dark-border hover:border-primary/40',
                ]"
              >
                <div class="flex items-center gap-3">
                  <input
                    type="radio"
                    name="chatProvider"
                    :value="opt.provider"
                    :checked="effectiveChatProvider === opt.provider"
                    :disabled="!opt.has_key || savingPreference === 'chat'"
                    @change="setCapabilityProvider('chat', opt.provider)"
                    class="accent-primary"
                  />
                  <div>
                    <p class="text-sm font-medium text-text-main dark:text-text-dark-main">{{ opt.label }}</p>
                    <p v-if="!opt.has_key" class="text-xs text-text-muted dark:text-text-dark-muted">Clé API non configurée</p>
                  </div>
                </div>
                <Check v-if="effectiveChatProvider === opt.provider && opt.has_key" class="w-4 h-4 text-primary shrink-0" stroke-width="2.5" />
              </label>
            </div>
          </div>
        </div>
      </BaseCard>
    </template>

  </div>
</template>
