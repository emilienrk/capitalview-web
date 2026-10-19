<script setup lang="ts">
/**
 * Writes a sorting rule by hand: every label that contains a text, or starts
 * with it, on one account or all of them, counted as one type. Never saved
 * blind: the preview says what it would count, and what something stronger
 * keeps — a pair, the user's own choice, a deposit, a more precise rule
 * (docs/bank-sorting.md in the API). Also rewrites an existing rule, one given
 * from an answer included.
 */
import { computed, reactive, ref, watch } from 'vue'

import { BaseAlert, BaseButton, BaseInput, BaseModal, BaseSegmentedControl, BaseSelect, BaseSkeleton } from '@/components'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import { useBankStore } from '@/stores/bank'
import { useCashflowTypesStore } from '@/stores/cashflowTypes'
import type { BankRulePreviewOperation, BankTypeRule, BankTypeRulePreview, BankTypeRuleWrite, TypeSource } from '@/types'
import { CASHFLOW_TYPES, answerHint, answerLabel, ruleTitle } from '@/utils/cashflowTypes'

const props = defineProps<{
  open: boolean
  /** The rule to rewrite; null for a new one. */
  rule: BankTypeRule | null
}>()

const emit = defineEmits<{ close: [] }>()

const types = useCashflowTypesStore()
const bank = useBankStore()
const { formatCurrency, formatDateShort } = useFormatters()
const { maskValue } = usePrivacyMode()

const EVERY_ACCOUNT = '*'
const MIN_LENGTH = 3

const form = reactive({
  match: 'contains' as BankTypeRuleWrite['match'],
  text: '',
  account: EVERY_ACCOUNT,
  direction: 'out' as 'out' | 'in',
  type: 'EXPENSE' as BankTypeRuleWrite['type'],
})

const preview = ref<BankTypeRulePreview | null>(null)
/** The form the preview was read for: saving needs the preview of exactly what is saved. */
const previewedFor = ref<string | null>(null)
const previewing = ref(false)
const previewError = ref<string | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const MATCH_OPTIONS = [
  { label: 'Contient', value: 'contains' },
  { label: 'Commence par', value: 'starts_with' },
]
const DIRECTION_OPTIONS = [
  { label: 'Sorties', value: 'out' },
  { label: 'Entrées', value: 'in' },
]

const accountOptions = computed(() => [
  { label: 'Tous mes comptes', value: EVERY_ACCOUNT },
  ...(bank.summary?.accounts ?? []).map((account) => ({ label: account.name, value: account.id })),
])

const isCredit = computed(() => form.direction === 'in')
const written = computed<BankTypeRuleWrite>(() => ({
  match: form.match,
  text: form.text,
  account_id: form.account === EVERY_ACCOUNT ? null : form.account,
  is_credit: isCredit.value,
  type: form.type,
}))
const key = computed(() => JSON.stringify(written.value))
const longEnough = computed(() => form.text.replace(/\s/g, '').length >= MIN_LENGTH)
const ready = computed(
  () => longEnough.value && !previewing.value && preview.value !== null && previewedFor.value === key.value,
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const rule = props.rule
    form.match = rule && rule.match !== 'similar' ? rule.match : 'contains'
    // A rule given from an answer is rewritten from the label it reads by.
    form.text = rule ? (rule.match === 'similar' ? rule.label ?? rule.signature : rule.signature) : ''
    form.account = rule?.account_id ?? EVERY_ACCOUNT
    form.direction = rule?.is_credit ? 'in' : 'out'
    form.type = rule?.type ?? 'EXPENSE'
    preview.value = null
    previewedFor.value = null
    error.value = null
    takeOverrides.value = false
    if (!bank.summary) void bank.fetchAccounts()
    // The same rule opened twice leaves the form as it was: nothing else would ask.
    schedule()
  },
)

let timer: ReturnType<typeof setTimeout> | undefined
let asked = 0

watch(key, schedule)

function schedule(): void {
  clearTimeout(timer)
  previewError.value = null
  if (!props.open || !longEnough.value) {
    preview.value = null
    previewedFor.value = null
    previewing.value = false
    return
  }
  previewing.value = true
  timer = setTimeout(() => void readPreview(), 350)
}

async function readPreview(): Promise<void> {
  const ask = ++asked
  const forKey = key.value
  try {
    const answer = await types.previewRule(written.value, props.rule?.id ?? null)
    // A slower answer for an older form never replaces the one asked last.
    if (ask !== asked) return
    preview.value = answer
    previewedFor.value = forKey
  } catch (e) {
    if (ask !== asked) return
    preview.value = null
    previewError.value = e instanceof Error ? e.message : "Impossible de calculer l'aperçu."
  } finally {
    if (ask === asked) previewing.value = false
  }
}

async function save(): Promise<void> {
  if (!ready.value) return
  saving.value = true
  error.value = null
  try {
    const handed = takeOverrides.value && Boolean(preview.value?.overridden_count)
    await types.writeRule({ ...written.value, take_overrides: handed }, props.rule?.id ?? null)
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Impossible d'enregistrer cette règle."
  } finally {
    saving.value = false
  }
}

// The more precise rules are named on their own line, not here.
const KEPT_REASONS: Partial<Record<TypeSource, string>> = {
  pair: 'liées par une paire',
  override: 'déjà classées ainsi à la main',
  contribution: "rapprochées d'un dépôt",
}

const keptSentence = computed(() => {
  const kept = (preview.value?.kept ?? []).filter((item) => KEPT_REASONS[item.reason])
  const count = kept.reduce((sum, item) => sum + item.count, 0)
  if (!count) return null
  const reasons = kept.map((item) => `${item.count} ${KEPT_REASONS[item.reason]}`)
  return `${count} ${count > 1 ? 'restent' : 'reste'} comme ${count > 1 ? 'elles sont' : 'elle est'} : ${reasons.join(', ')}.`
})

/** The rules it takes operations from: until now they counted them. */
const takenSentence = computed(() => {
  const taken = preview.value?.taken ?? []
  if (!taken.length) return null
  return `Elle en prend ${taken.map((other) => `${other.count} à la règle ${ruleTitle(other)}`).join(', ')}.`
})

/** The more precise rules that keep theirs. */
const yieldedSentence = computed(() => {
  const yielded = preview.value?.yielded ?? []
  if (!yielded.length) return null
  const kept = yielded.map((other) => `${other.count} à la règle ${ruleTitle(other)}`).join(', ')
  return `Plus précises, d'autres règles gardent les leurs : ${kept}.`
})

/** The confirmed recurrings whose payments it types otherwise: they leave what is fixed. */
const recurringSentence = computed(() => {
  const names = preview.value?.recurring ?? []
  if (!names.length) return null
  const listed = names.map((name) => `« ${name} »`).join(', ')
  const kind = isCredit.value ? 'revenus' : 'paiements'
  return `${listed} ne ${names.length > 1 ? 'compteront' : 'comptera'} plus dans vos ${kind} récurrents.`
})

/** Handing the rule what was chosen by hand is said and asked, never done by default. */
const takeOverrides = ref(false)

/** Most of a side is a rule too wide: "VIR" reaches every transfer, own ones included. */
const tooWide = computed(() => {
  const found = preview.value
  return Boolean(found && found.side_count >= 10 && found.touched_count + found.kept_count > found.side_count / 2)
})

/** What the rule does, said by what it changes: typing expenses as expenses changes no figure. */
function counted(found: BankTypeRulePreview): string {
  const many = found.touched_count > 1
  const type = answerLabel(form.type, isCredit.value)
  const reached = many ? `${found.touched_count} opérations correspondent` : '1 opération correspond'
  if (!found.changed_count) {
    return `${reached}, déjà comptée${many ? 's' : ''} en ${type} : la règle ${many ? 'les y' : "l'y"} gardera, les prochaines aussi.`
  }
  if (found.changed_count === found.touched_count) return `${reached} : ${many ? 'toutes passeront' : 'elle passera'} en ${type}.`
  const moved = found.changed_count > 1 ? `${found.changed_count} passeront` : '1 passera'
  return `${reached} : ${moved} en ${type}, les autres y sont déjà.`
}

function signed(op: BankRulePreviewOperation): string {
  const value = Number(op.amount)
  return maskValue(formatCurrency(op.is_credit ? value : -value, op.currency))
}
</script>

<template>
  <BaseModal :open="open" :title="rule ? 'Modifier la règle' : 'Nouvelle règle'" size="lg" scroll-fade @close="emit('close')">
    <form class="space-y-5" @submit.prevent="save">
      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>

      <div class="space-y-2">
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Le libellé…</p>
        <BaseSegmentedControl v-model="form.match" :options="MATCH_OPTIONS" size="sm" />
        <BaseInput
          id="sorting-rule-text"
          v-model="form.text"
          placeholder="ex. SPOTIFY"
          aria-label="Texte du libellé"
          autocomplete="off"
        />
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          Pris tel quel, sans tenir compte des majuscules ni des accents. {{ MIN_LENGTH }} caractères au moins.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseSelect id="sorting-rule-account" v-model="form.account" label="Sur" :options="accountOptions" />
        <div class="space-y-1.5">
          <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Pour les</p>
          <BaseSegmentedControl v-model="form.direction" :options="DIRECTION_OPTIONS" size="sm" />
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Compter en</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Type">
          <button
            v-for="type in CASHFLOW_TYPES"
            :key="type"
            type="button"
            :aria-pressed="form.type === type"
            :title="answerHint(type, isCredit)"
            :class="[
              'flex items-center px-3 py-2 rounded-button border text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              form.type === type
                ? 'border-primary bg-primary/5 text-text-main dark:text-text-dark-main'
                : 'border-surface-border dark:border-surface-dark-border text-text-main dark:text-text-dark-main hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
            ]"
            @click="form.type = type"
          >
            {{ answerLabel(type, isCredit) }}
          </button>
        </div>
      </div>

      <section class="space-y-2 rounded-card border border-surface-border dark:border-surface-dark-border p-3" aria-live="polite">
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Aperçu</p>
        <p v-if="!longEnough" class="text-sm text-text-muted dark:text-text-dark-muted">
          Écrivez le texte du libellé pour voir les opérations que la règle comptera.
        </p>
        <p v-else-if="previewError" class="text-sm text-danger">{{ previewError }}</p>
        <div v-else-if="previewing && !preview" class="space-y-2">
          <BaseSkeleton v-for="i in 3" :key="i" variant="rect" width="100%" height="2.25rem" />
        </div>
        <template v-else-if="preview">
          <div :class="['space-y-2 transition-opacity', previewing ? 'opacity-60' : '']">
            <p class="text-sm text-text-main dark:text-text-dark-main">
              <template v-if="preview.touched_count">{{ counted(preview) }}</template>
              <template v-else>Aucune opération ne correspond pour l'instant : la règle comptera les prochaines.</template>
            </p>
            <p v-if="takenSentence" class="text-sm text-text-muted dark:text-text-dark-muted">{{ takenSentence }}</p>
            <p v-if="yieldedSentence" class="text-sm text-text-muted dark:text-text-dark-muted">{{ yieldedSentence }}</p>
            <p v-if="keptSentence" class="text-sm text-text-muted dark:text-text-dark-muted">{{ keptSentence }}</p>
            <p v-if="recurringSentence" class="text-sm text-text-main dark:text-text-dark-main">{{ recurringSentence }}</p>
            <BaseAlert v-if="tooWide" variant="warning">
              Cette règle touche plus de la moitié des {{ isCredit ? 'entrées' : 'sorties' }}
              {{ form.account === EVERY_ACCOUNT ? 'de vos comptes' : 'de ce compte' }} : vérifiez qu'elle n'est pas trop large.
            </BaseAlert>
            <ul
              v-if="preview.touched.length"
              class="max-h-60 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border -mx-1"
            >
              <li v-for="op in preview.touched" :key="op.id" class="flex items-baseline gap-3 px-1 py-1.5">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-text-main dark:text-text-dark-main" :title="op.label ?? undefined">
                    {{ op.label ?? 'Opération sans libellé' }}
                  </p>
                  <p class="text-xs text-text-muted dark:text-text-dark-muted">
                    {{ formatDateShort(op.operation_date) }} · {{ op.account_name }}
                    <template v-if="op.cashflow_type !== form.type">
                      · <span class="text-text-main dark:text-text-dark-main">
                        {{ answerLabel(op.cashflow_type, op.is_credit) }} → {{ answerLabel(form.type, isCredit) }}
                      </span>
                    </template>
                  </p>
                </div>
                <span class="shrink-0 text-sm tabular-nums text-text-main dark:text-text-dark-main">{{ signed(op) }}</span>
              </li>
            </ul>
            <p v-if="preview.touched_count > preview.touched.length" class="text-xs text-text-muted dark:text-text-dark-muted">
              Et {{ preview.touched_count - preview.touched.length }} plus anciennes.
            </p>

            <div v-if="preview.overridden_count" class="space-y-2 pt-3 border-t border-surface-border dark:border-surface-dark-border">
              <p class="text-sm text-text-main dark:text-text-dark-main">
                {{ preview.overridden_count }}
                {{ preview.overridden_count > 1 ? 'opérations que vous avez classées' : 'opération que vous avez classée' }}
                à la main autrement : votre choix l'emporte sur la règle.
              </p>
              <ul class="max-h-40 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border -mx-1">
                <li v-for="op in preview.overridden" :key="op.id" class="flex items-baseline gap-3 px-1 py-1.5">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-text-main dark:text-text-dark-main" :title="op.label ?? undefined">
                      {{ op.label ?? 'Opération sans libellé' }}
                    </p>
                    <p class="text-xs text-text-muted dark:text-text-dark-muted">
                      {{ formatDateShort(op.operation_date) }} · {{ op.account_name }} · classée en
                      {{ answerLabel(op.cashflow_type, op.is_credit) }}
                    </p>
                  </div>
                  <span class="shrink-0 text-sm tabular-nums text-text-main dark:text-text-dark-main">{{ signed(op) }}</span>
                </li>
              </ul>
              <label class="flex items-start gap-2 text-sm text-text-main dark:text-text-dark-main cursor-pointer">
                <input id="sorting-rule-take-overrides" v-model="takeOverrides" type="checkbox" class="mt-0.5 accent-primary" />
                <span>
                  {{ preview.overridden_count > 1 ? 'Les passer' : 'La passer' }} aussi en {{ answerLabel(form.type, isCredit) }}
                  <span class="block text-xs text-text-muted dark:text-text-dark-muted">
                    Vos choix à la main sur {{ preview.overridden_count > 1 ? 'ces opérations' : 'cette opération' }} seront retirés.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </template>
      </section>
    </form>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <BaseButton variant="ghost" @click="emit('close')">Annuler</BaseButton>
        <BaseButton :disabled="!ready" :loading="saving" @click="save">
          {{ rule ? 'Enregistrer' : 'Créer la règle' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
