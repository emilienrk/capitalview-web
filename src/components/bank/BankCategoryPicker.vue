<script setup lang="ts">
/**
 * Files one operation under a category — and, by default, every operation
 * whose label holds the words kept ticked, through a rule. The words come
 * rarest first, the proposed ones ticked: a merchant's name, not "CARTE".
 */
import { computed, ref, watch } from 'vue'
import { Ban, Check, Plus } from 'lucide-vue-next'

import { BaseAlert, BaseButton, BaseModal, BaseSelect, BaseSkeleton } from '@/components'
import { useCategoryPicker } from '@/composables/useCategoryPicker'
import { useBankCategoriesStore } from '@/stores/bankCategories'
import { CATEGORY_NATURE_LABELS, CATEGORY_NATURE_OPTIONS } from '@/utils/bankCategories'
import type { AvailableCategory, BankCategoryAssignResult, CategoryNature } from '@/types'

const props = defineProps<{
  open: boolean
  transactionId: string | null
  label: string | null
  isCredit: boolean
  currentCategoryId?: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: [result: BankCategoryAssignResult]
}>()

const store = useBankCategoriesStore()
const picker = useCategoryPicker()
const { applyToSimilar, words, selectedWords, tokens, toggleWord } = picker

const NONE = '__none__'

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const search = ref('')
/** A category name key, NONE, or null before any choice. */
const choice = ref<string | null>(null)
const newNature = ref<string>('EXPENSE')

function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

watch(
  () => [props.open, props.transactionId] as const,
  async ([open, id]) => {
    picker.reset()
    search.value = ''
    error.value = null
    choice.value = null
    newNature.value = props.isCredit ? 'INCOME' : 'EXPENSE'
    if (!open || !id) return
    loading.value = true
    try {
      const [, ruleWords] = await Promise.all([store.fetchAvailable('bank'), store.fetchRuleWords(id)])
      if (props.transactionId !== id) return
      picker.setWords(ruleWords.words, ruleWords.proposed)
      const current = store.available.find((c) => c.id && c.id === props.currentCategoryId)
      if (current) choice.value = nameKey(current.name)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Impossible de charger les catégories.'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const filtered = computed(() => {
  const query = nameKey(search.value)
  return store.available.filter((c) => !query || nameKey(c.name).includes(query))
})

/** Offered when what is typed names no existing category. */
const canCreate = computed(() => {
  const query = nameKey(search.value)
  return query !== '' && !store.available.some((c) => nameKey(c.name) === query)
})

const creating = computed(() => choice.value !== null && choice.value === nameKey(search.value) && canCreate.value)

const chosen = computed<AvailableCategory | null>(() =>
  store.available.find((c) => nameKey(c.name) === choice.value) ?? null,
)

const isNone = computed(() => choice.value === NONE)

const canSave = computed(() => {
  if (saving.value || loading.value || choice.value === null) return false
  if (!isNone.value && applyToSimilar.value && tokens.value.length === 0) return false
  return isNone.value || creating.value || chosen.value !== null
})

async function resolveCategoryId(): Promise<string | null> {
  if (isNone.value) return null
  if (creating.value) {
    return (await store.createCategory(search.value.trim(), newNature.value as CategoryNature)).id
  }
  const category = chosen.value!
  return category.id ?? (await store.materializeCashflowCategory(category.name)).id
}

async function save(): Promise<void> {
  if (!props.transactionId || !canSave.value) return
  saving.value = true
  error.value = null
  try {
    picker.categoryId.value = await resolveCategoryId()
    const result = await store.assignCategory(props.transactionId, picker.payload())
    emit('saved', result)
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette catégorie."
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" title="Catégorie de l'opération" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted truncate" :title="label ?? undefined">
        {{ label ?? 'Opération sans libellé' }}
      </p>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <input
        v-model="search"
        type="text"
        placeholder="Rechercher ou créer une catégorie…"
        aria-label="Rechercher ou créer une catégorie"
        class="w-full px-4 py-2.5 rounded-input border border-surface-border dark:border-surface-dark-border bg-surface dark:bg-surface-dark text-text-main dark:text-text-dark-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
      />

      <div v-if="loading" class="space-y-2">
        <BaseSkeleton v-for="i in 4" :key="i" variant="rect" width="100%" height="2.25rem" />
      </div>
      <ul v-else class="max-h-64 overflow-y-auto -mx-2 space-y-0.5" role="listbox" aria-label="Catégories">
        <li v-if="canCreate">
          <button
            type="button"
            :aria-selected="creating"
            :class="['w-full flex items-center gap-2 px-2 py-2 rounded-button text-left text-sm', creating ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover text-text-main dark:text-text-dark-main']"
            @click="choice = nameKey(search)"
          >
            <Plus class="w-4 h-4 shrink-0" />
            Créer « {{ search.trim() }} »
          </button>
          <div v-if="creating" class="px-2 pt-2 pb-1 sm:w-64">
            <BaseSelect v-model="newNature" label="Nature" :options="CATEGORY_NATURE_OPTIONS" />
          </div>
        </li>
        <li v-for="category in filtered" :key="category.name">
          <button
            type="button"
            :aria-selected="choice === nameKey(category.name)"
            :class="['w-full flex items-center gap-2 px-2 py-2 rounded-button text-left text-sm', choice === nameKey(category.name) ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover text-text-main dark:text-text-dark-main']"
            @click="choice = nameKey(category.name)"
          >
            <Check :class="['w-4 h-4 shrink-0', choice === nameKey(category.name) ? '' : 'invisible']" />
            <span class="flex-1 truncate">{{ category.name }}</span>
            <span class="text-xs text-text-muted dark:text-text-dark-muted">{{ CATEGORY_NATURE_LABELS[category.nature] }}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            :aria-selected="isNone"
            :class="['w-full flex items-center gap-2 px-2 py-2 rounded-button text-left text-sm', isNone ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover text-text-muted dark:text-text-dark-muted']"
            @click="choice = NONE"
          >
            <Ban class="w-4 h-4 shrink-0" />
            Sans catégorie
          </button>
        </li>
      </ul>

      <div v-if="!isNone && words.length" class="space-y-2 border-t border-surface-border dark:border-surface-dark-border pt-4">
        <label class="flex items-center gap-2 text-sm text-text-main dark:text-text-dark-main">
          <input v-model="applyToSimilar" type="checkbox" class="rounded border-surface-border text-primary focus:ring-primary/20" />
          Appliquer aux opérations similaires
        </label>
        <div v-if="applyToSimilar" class="flex flex-wrap gap-1.5" role="group" aria-label="Mots requis dans le libellé">
          <button
            v-for="word in words"
            :key="word"
            type="button"
            :aria-pressed="selectedWords.has(word)"
            :class="[
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              selectedWords.has(word)
                ? 'bg-primary text-primary-content'
                : 'bg-background-subtle dark:bg-background-dark-subtle text-text-muted dark:text-text-dark-muted line-through',
            ]"
            @click="toggleWord(word)"
          >
            {{ word }}
          </button>
        </div>
        <p v-if="applyToSimilar" class="text-xs text-text-muted dark:text-text-dark-muted">
          Toutes les opérations dont le libellé contient ces mots seront rangées ici.
        </p>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">Annuler</BaseButton>
      <BaseButton :loading="saving" :disabled="!canSave" @click="save">Enregistrer</BaseButton>
    </template>
  </BaseModal>
</template>
