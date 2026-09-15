<script setup lang="ts">
/**
 * The Banque section's Catégories tab: what is left to file, heaviest first,
 * the categories and the rules that file into them, and — when the user opted
 * in — filing the rest with the AI.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronDown, Pencil, Plus, Sparkles, Tag, Trash2 } from 'lucide-vue-next'

import {
  BaseAlert, BaseButton, BaseCard, BaseEmptyState, BaseSelect, BaseSkeleton,
} from '@/components'
import BankCategoryPicker from '@/components/bank/BankCategoryPicker.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useBankCategoriesStore } from '@/stores/bankCategories'
import { useSettingsStore } from '@/stores/settings'
import { CATEGORY_NATURE_OPTIONS } from '@/utils/bankCategories'
import type { BankCategory, BankCategoryAssignResult, BankUncategorizedGroup, CategoryNature } from '@/types'

const bank = useBankStore()
const store = useBankCategoriesStore()
const settingsStore = useSettingsStore()
const { confirmDialog } = useConfirm()
const { formatCurrency } = useFormatters()
const { maskValue } = usePrivacyMode()

const loadFailed = ref(false)
const actionError = ref<string | null>(null)
const message = ref<string | null>(null)

const aiEnabled = computed(() =>
  Boolean(settingsStore.settings?.ai_feature_enabled && settingsStore.settings?.ai_categorization_enabled),
)

async function load(): Promise<void> {
  loadFailed.value = false
  try {
    await Promise.all([store.fetchCategories(), store.fetchRules(), store.fetchQueue()])
  } catch {
    loadFailed.value = true
  }
}

onMounted(() => void load())
// A sync, an import or a filing from another tab moved what is left to file.
watch(() => bank.dataRevision, () => {
  if (!store.aiProgress.running) void load()
})

function guard(action: () => Promise<void>): Promise<void> {
  actionError.value = null
  return action().catch((e) => {
    actionError.value = e instanceof Error ? e.message : "L'opération a échoué."
  })
}

// ── The queue ───────────────────────────────────────────────

function groupAmount(group: BankUncategorizedGroup): string {
  const value = Number(group.total)
  return maskValue(formatCurrency(group.is_credit ? value : -value, group.currency))
}

function shortDay(day: string | null): string {
  if (!day) return ''
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const filing = ref<BankUncategorizedGroup | null>(null)

function onFiled(result: BankCategoryAssignResult): void {
  const count = result.filed_count
  message.value = result.transaction.category_name
    ? `${count} opération${count > 1 ? 's' : ''} rangée${count > 1 ? 's' : ''} dans ${result.transaction.category_name}.`
    : 'Opération laissée sans catégorie.'
}

// ── The categories ──────────────────────────────────────────

const newName = ref('')
const newNature = ref<string>('EXPENSE')
const creating = ref(false)

async function create(): Promise<void> {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  await guard(async () => {
    await store.createCategory(name, newNature.value as CategoryNature)
    newName.value = ''
  })
  creating.value = false
}

const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(category: BankCategory): void {
  renamingId.value = category.id
  renameValue.value = category.name
}

async function commitRename(category: BankCategory): Promise<void> {
  const name = renameValue.value.trim()
  renamingId.value = null
  if (!name || name === category.name) return
  await guard(() => store.updateCategory(category.id, { name }))
}

function changeNature(category: BankCategory, nature: string | number | undefined): Promise<void> {
  if (nature === undefined || nature === category.nature) return Promise.resolve()
  return guard(() => store.updateCategory(category.id, { nature: nature as CategoryNature }))
}

async function remove(category: BankCategory): Promise<void> {
  const rules = category.rule_count
  const confirmed = await confirmDialog({
    title: 'Supprimer la catégorie',
    message: `Supprimer « ${category.name} »${rules ? ` et ses ${rules} règle${rules > 1 ? 's' : ''}` : ''} ? Les opérations qu'elle range repasseront à ranger.`,
    confirmLabel: 'Supprimer',
  })
  if (confirmed) await guard(() => store.deleteCategory(category.id))
}

const expanded = ref<Set<string>>(new Set())

function toggleRules(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const rulesByCategory = computed(() => {
  const map: Record<string, typeof store.rules> = {}
  for (const rule of store.rules) (map[rule.category_id] ??= []).push(rule)
  return map
})

// ── AI ──────────────────────────────────────────────────────

const aiShare = computed(() => {
  const { processed, remaining } = store.aiProgress
  const total = processed + (remaining ?? 0)
  return total ? Math.round((processed / total) * 100) : 0
})
const aiDone = computed(() => !store.aiProgress.running && store.aiProgress.batches > 0)
</script>

<template>
  <div class="space-y-6">
    <BaseAlert v-if="actionError" variant="danger" dismissible @dismiss="actionError = null">{{ actionError }}</BaseAlert>
    <BaseAlert v-if="message" variant="success" dismissible @dismiss="message = null">{{ message }}</BaseAlert>

    <div v-if="loadFailed" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">Impossible de charger les catégories.</p>
      <BaseButton size="sm" variant="outline" @click="load">Réessayer</BaseButton>
    </div>

    <!-- AI -->
    <BaseCard>
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex-1 min-w-0">
          <p class="flex items-center gap-2 font-semibold text-text-main dark:text-text-dark-main">
            <Sparkles class="w-4 h-4 text-primary" /> Ranger avec l'IA
          </p>
          <p v-if="aiEnabled" class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
            Les groupes les plus lourds sans règle sont proposés à votre fournisseur d'IA, par lots. Chaque réponse
            devient une règle marquée IA, que vous pouvez corriger.
          </p>
          <p v-else class="mt-1 text-sm text-text-muted dark:text-text-dark-muted">
            Désactivée. Les règles et le rangement manuel fonctionnent sans elle.
            <router-link :to="{ name: 'settings', query: { tab: 'ia' } }" class="text-primary font-medium hover:underline">
              Activer dans Réglages → IA
            </router-link>
          </p>
        </div>
        <template v-if="aiEnabled">
          <BaseButton v-if="store.aiProgress.running" variant="outline" @click="store.stopAiCategorization()">
            Arrêter après ce lot
          </BaseButton>
          <BaseButton v-else :disabled="!store.queue?.total_groups" @click="store.runAiCategorization()">
            <Sparkles class="w-4 h-4 mr-1.5" /> Ranger avec l'IA
          </BaseButton>
        </template>
      </div>
      <div v-if="aiEnabled && (store.aiProgress.running || aiDone)" class="mt-4 space-y-2">
        <div class="h-2 rounded-full bg-background-subtle dark:bg-background-dark-subtle overflow-hidden" role="progressbar" :aria-valuenow="aiShare" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full bg-primary transition-all duration-300" :style="{ width: `${aiShare}%` }" />
        </div>
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          {{ store.aiProgress.processed }} groupe{{ store.aiProgress.processed > 1 ? 's' : '' }} proposé{{ store.aiProgress.processed > 1 ? 's' : '' }} ·
          {{ store.aiProgress.rulesCreated }} règle{{ store.aiProgress.rulesCreated > 1 ? 's' : '' }} créée{{ store.aiProgress.rulesCreated > 1 ? 's' : '' }} ·
          {{ store.aiProgress.categoriesCreated }} nouvelle{{ store.aiProgress.categoriesCreated > 1 ? 's' : '' }} catégorie{{ store.aiProgress.categoriesCreated > 1 ? 's' : '' }}
          <template v-if="aiDone && store.aiProgress.remaining">
            · {{ store.aiProgress.remaining }} laissé{{ store.aiProgress.remaining > 1 ? 's' : '' }} à ranger
          </template>
        </p>
        <BaseAlert v-if="store.aiProgress.error" variant="danger">{{ store.aiProgress.error }}</BaseAlert>
      </div>
    </BaseCard>

    <!-- The queue -->
    <BaseCard :padding="false" class="overflow-hidden">
      <template #header>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">À ranger</h3>
          <p v-if="store.queue" class="text-sm text-text-muted dark:text-text-dark-muted">
            {{ store.queue.total_groups }} groupe{{ store.queue.total_groups > 1 ? 's' : '' }} ·
            {{ store.queue.total_operations }} opération{{ store.queue.total_operations > 1 ? 's' : '' }}
          </p>
        </div>
      </template>
      <div v-if="!store.queue && !loadFailed" class="p-4 sm:p-6 space-y-3">
        <BaseSkeleton v-for="i in 5" :key="i" variant="rect" width="100%" height="2.75rem" />
      </div>
      <BaseEmptyState
        v-else-if="store.queue && !store.queue.groups.length"
        title="Tout est rangé"
        description="Chaque opération est rangée par une règle, à la main, ou comptée comme virement entre vos comptes."
      />
      <ul v-else-if="store.queue" class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <li v-for="group in store.queue.groups" :key="`${group.signature}:${group.is_credit}`" class="flex items-center gap-3 px-4 sm:px-6 py-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-main dark:text-text-dark-main" :title="group.label">{{ group.label }}</p>
            <p class="mt-0.5 text-xs text-text-muted dark:text-text-dark-muted">
              {{ group.count }} opération{{ group.count > 1 ? 's' : '' }} · dernière le {{ shortDay(group.last_date) }}
            </p>
          </div>
          <p :class="['shrink-0 text-sm font-semibold tabular-nums', group.is_credit ? 'text-success' : 'text-text-main dark:text-text-dark-main']">
            {{ groupAmount(group) }}
          </p>
          <BaseButton size="sm" variant="outline" class="shrink-0" @click="filing = group">
            <Tag class="w-3.5 h-3.5 mr-1" /> Ranger
          </BaseButton>
        </li>
      </ul>
    </BaseCard>

    <!-- The categories -->
    <BaseCard :padding="false" class="overflow-hidden">
      <template #header>
        <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Catégories</h3>
      </template>
      <form class="flex flex-col sm:flex-row gap-3 px-4 sm:px-6 py-4 border-b border-surface-border dark:border-surface-dark-border" @submit.prevent="create">
        <input
          v-model="newName"
          type="text"
          placeholder="Nouvelle catégorie"
          aria-label="Nom de la nouvelle catégorie"
          maxlength="60"
          class="flex-1 px-4 py-2.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
        />
        <div class="sm:w-44">
          <BaseSelect v-model="newNature" :options="CATEGORY_NATURE_OPTIONS" />
        </div>
        <BaseButton type="submit" :loading="creating" :disabled="!newName.trim()">
          <Plus class="w-4 h-4 mr-1" /> Ajouter
        </BaseButton>
      </form>
      <BaseEmptyState
        v-if="!store.categories.length"
        title="Aucune catégorie"
        description="Créez-en une ici, ou depuis une opération de l'onglet Opérations."
      />
      <ul v-else class="divide-y divide-surface-border dark:divide-surface-dark-border">
        <li v-for="category in store.categories" :key="category.id" class="px-4 sm:px-6 py-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="min-w-0 flex-1 flex items-center gap-2">
              <input
                v-if="renamingId === category.id"
                v-model="renameValue"
                type="text"
                maxlength="60"
                aria-label="Nouveau nom"
                class="flex-1 px-3 py-1.5 rounded-input border border-primary bg-surface dark:bg-surface-dark text-sm text-text-main dark:text-text-dark-main focus:outline-none"
                @keydown.enter.prevent="commitRename(category)"
                @keydown.escape="renamingId = null"
                @blur="commitRename(category)"
              />
              <template v-else>
                <span class="truncate text-sm font-medium text-text-main dark:text-text-dark-main">{{ category.name }}</span>
                <span v-if="category.origin === 'ai'" class="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-primary" title="Créée par l'IA">
                  <Sparkles class="w-2.5 h-2.5" />IA
                </span>
                <BaseButton icon size="sm" variant="ghost" aria-label="Renommer" title="Renommer" @click="startRename(category)">
                  <Pencil class="w-3.5 h-3.5" />
                </BaseButton>
              </template>
            </div>
            <div class="w-40">
              <BaseSelect
                :model-value="category.nature"
                :options="CATEGORY_NATURE_OPTIONS"
                @update:model-value="(nature) => changeNature(category, nature)"
              />
            </div>
            <button
              type="button"
              class="flex items-center gap-1 text-xs text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main disabled:opacity-50"
              :disabled="!category.rule_count"
              :aria-expanded="expanded.has(category.id)"
              @click="toggleRules(category.id)"
            >
              {{ category.rule_count }} règle{{ category.rule_count > 1 ? 's' : '' }}
              <ChevronDown v-if="category.rule_count" :class="['w-3.5 h-3.5 transition-transform', expanded.has(category.id) ? 'rotate-180' : '']" />
            </button>
            <BaseButton icon size="sm" variant="ghost" aria-label="Supprimer" title="Supprimer" @click="remove(category)">
              <Trash2 class="w-4 h-4" />
            </BaseButton>
          </div>
          <ul v-if="expanded.has(category.id)" class="mt-2 ml-1 space-y-1">
            <li v-for="rule in rulesByCategory[category.id] ?? []" :key="rule.id" class="flex items-center gap-2 text-xs">
              <span class="flex flex-wrap gap-1">
                <span v-for="token in rule.tokens" :key="token" class="px-2 py-0.5 rounded-full bg-background-subtle dark:bg-background-dark-subtle text-text-main dark:text-text-dark-main">
                  {{ token }}
                </span>
              </span>
              <span class="text-text-muted dark:text-text-dark-muted">{{ rule.source === 'ai' ? 'IA' : 'vous' }}</span>
              <BaseButton icon size="sm" variant="ghost" aria-label="Supprimer la règle" title="Supprimer la règle" @click="guard(() => store.deleteRule(rule.id))">
                <Trash2 class="w-3.5 h-3.5" />
              </BaseButton>
            </li>
          </ul>
        </li>
      </ul>
    </BaseCard>

    <BankCategoryPicker
      :open="filing !== null"
      :transaction-id="filing?.transaction_id ?? null"
      :label="filing?.label ?? null"
      :is-credit="filing?.is_credit ?? false"
      @close="filing = null"
      @saved="onFiled"
    />
  </div>
</template>
