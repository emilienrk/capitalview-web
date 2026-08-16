<script setup lang="ts">
import { Sparkles, Trash2, Eye, MessageSquare, ChevronDown, Check, KeyRound, SlidersHorizontal } from 'lucide-vue-next'
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useConfirm } from '@/composables/useConfirm'
import { apiClient } from '@/api/client'
import { BaseButton, BaseAlert, BaseInput, BaseSelect, BaseSkeleton, BaseToggle } from '@/components'
import SettingsSection from './SettingsSection.vue'
import type { AIOptionsResponse, AIProviderUpdate, AIProviderConfig } from '@/types'

const settingsStore = useSettingsStore()
const { confirmDialog } = useConfirm()

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
  const confirmed = await confirmDialog({
    title: 'Supprimer la clé API',
    message: `Supprimer la clé API ${label} ?`,
    confirmLabel: 'Supprimer',
  })
  if (!confirmed) return

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

/** Model list as BaseSelect expects it, the default one saying so in its label. */
function modelOptions(models: { id: string; label: string; default?: boolean }[]) {
  return models.map((model) => ({
    value: model.id,
    label: `${model.label}${model.default ? ' (défaut)' : ''}`,
  }))
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
    <SettingsSection
      :icon="Sparkles"
      title="Intelligence Artificielle"
      subtitle="Activez les fonctionnalités IA pour l'import par image et l'analyse de portefeuille"
    >
      <template #header-action>
        <BaseToggle
          :model-value="isAiEnabled"
          aria-label="Activer les fonctionnalités IA"
          @update:model-value="toggleAiFeature"
        />
      </template>
    </SettingsSection>

    <template v-if="isAiEnabled">
      <!-- API Keys & Models per provider -->
      <SettingsSection
        :icon="KeyRound"
        title="Clés API & Modèles"
        subtitle="Vos clés sont chiffrées de bout en bout avec votre Master Key avant d'être stockées."
      >

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

            <!-- API Key input. Was a bare <input> painted with bg-surface-bg,
                 a token the palette never defined: the class did nothing and
                 the field stayed white in dark mode. -->
            <BaseInput
              type="password"
              :model-value="apiKeyInputs[p.provider] ?? ''"
              :placeholder="keyPlaceholder(p.provider)"
              @update:model-value="apiKeyInputs[p.provider] = String($event)"
            >
              <template #action>
                <BaseButton
                  size="sm"
                  :loading="savingProvider === p.provider"
                  :disabled="!apiKeyInputs[p.provider]?.trim()"
                  @click="saveProviderKey(p.provider)"
                >
                  Enregistrer
                </BaseButton>
              </template>
            </BaseInput>

            <!-- Success / Error feedback -->
            <p v-if="providerSuccess[p.provider]" class="text-xs text-success">{{ providerSuccess[p.provider] }}</p>
            <p v-if="providerError[p.provider]" class="text-xs text-danger">{{ providerError[p.provider] }}</p>

            <!-- Model selector (only if key configured) -->
            <BaseSelect
              v-if="configuredProviders[p.provider]?.has_key && p.models.length > 1"
              label="Modèle"
              placeholder="Modèle par défaut"
              :model-value="configuredProviders[p.provider]?.selected_model ?? ''"
              :options="modelOptions(p.models)"
              @update:model-value="saveModel(p.provider, String($event))"
            />
          </div>
        </div>
      </SettingsSection>

      <!-- Capability preferences -->
      <SettingsSection
        :icon="SlidersHorizontal"
        title="Préférences par usage"
        subtitle="Choisissez quel provider utiliser pour chaque type de tâche IA."
      >

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
      </SettingsSection>
    </template>

  </div>
</template>
