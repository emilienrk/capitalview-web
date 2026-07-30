<script setup lang="ts">
/**
 * The target plan: a monthly amount, an allocation by asset key, and the month
 * it starts from.
 *
 * The starting month matters more than it looks. Without it a plan declared
 * today is scored backwards over years during which no plan existed, and the
 * page hands out a damning adherence figure about months the user never
 * promised anything for.
 */
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseInput } from '@/components'
import { useSettingsStore } from '@/stores/settings'
import type { WeightOut } from '@/types'

const props = defineProps<{
  plan: Record<string, unknown> | null
  held: WeightOut[]
  error?: string | null
}>()
const emit = defineEmits<{ changed: [] }>()

const settingsStore = useSettingsStore()

interface Line {
  asset_key: string
  share: string
}

const isOpen = ref(false)
const isSaving = ref(false)
const localError = ref<string | null>(null)
const monthlyTarget = ref('')
const since = ref('')
const lines = ref<Line[]>([])

function load(): void {
  const plan = props.plan ?? {}
  monthlyTarget.value = String(plan.monthly_target ?? '')
  since.value = String(plan.since ?? '')
  const allocation = (plan.allocation ?? {}) as Record<string, string>
  const entries = Object.entries(allocation)
  lines.value = entries.length
    ? entries.map(([asset_key, share]) => ({ asset_key, share: String(share) }))
    : props.held.slice(0, 4).map((weight) => ({
        asset_key: weight.asset_key,
        share: (Number(weight.weight) * 100).toFixed(0),
      }))
}

watch(() => props.plan, load, { immediate: true })

const hasPlan = computed(() => Boolean(props.plan && Object.keys(props.plan).length))

const allocationTotal = computed(() =>
  lines.value.reduce((sum, line) => sum + (Number(line.share) || 0), 0),
)

function addLine(): void {
  lines.value.push({ asset_key: '', share: '' })
}

function removeLine(index: number): void {
  lines.value.splice(index, 1)
}

async function save(): Promise<void> {
  localError.value = null
  const amount = Number(monthlyTarget.value)
  if (!amount || amount <= 0) {
    localError.value = 'Indique un montant mensuel supérieur à zéro.'
    return
  }
  const filled = lines.value.filter((line) => line.asset_key.trim() && line.share.trim())
  if (filled.length && Math.abs(allocationTotal.value - 100) > 1) {
    localError.value = `Ton allocation fait ${allocationTotal.value} % au lieu de 100 %.`
    return
  }

  const allocation: Record<string, string> = {}
  filled.forEach((line) => {
    allocation[line.asset_key.trim().toUpperCase()] = line.share.trim()
  })

  isSaving.value = true
  const ok = await settingsStore.updateSettings({
    investment_plan: {
      monthly_target: monthlyTarget.value.trim(),
      allocation,
      ...(since.value.trim() ? { since: since.value.trim() } : {}),
    },
  })
  isSaving.value = false
  if (ok) {
    isOpen.value = false
    emit('changed')
  }
}

async function clear(): Promise<void> {
  isSaving.value = true
  // An empty object is the delete: the API turns it back into "no plan".
  const ok = await settingsStore.updateSettings({ investment_plan: {} })
  isSaving.value = false
  if (ok) {
    isOpen.value = false
    emit('changed')
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Plan cible</p>
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          <template v-if="hasPlan">
            {{ plan?.monthly_target }} €/mois investis
            <template v-if="plan?.since"> depuis {{ plan.since }}</template>
          </template>
          <template v-else>
            Optionnel. Sans plan, tout le reste de la page fonctionne — avec, une comparaison de
            plus : ce que tu avais écrit contre ce que tu as fait.
          </template>
        </p>
      </div>
      <BaseButton variant="secondary" @click="isOpen = !isOpen">
        {{ isOpen ? 'Fermer' : hasPlan ? 'Modifier' : 'Déclarer un plan' }}
      </BaseButton>
    </div>

    <p v-if="error" class="mt-2 text-xs text-warning">{{ error }}</p>

    <div v-if="isOpen" class="mt-4 flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BaseInput
          id="plan-monthly"
          v-model="monthlyTarget"
          type="number"
          label="Montant mensuel à investir (€)"
          placeholder="500"
          :disabled="isSaving"
        />
        <BaseInput
          id="plan-since"
          v-model="since"
          label="À partir de (AAAA-MM)"
          placeholder="2025-01"
          :disabled="isSaving"
        />
      </div>

      <div>
        <p
          class="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted dark:text-text-dark-muted"
        >
          Allocation cible, par ISIN
        </p>
        <div v-for="(line, index) in lines" :key="index" class="mb-2 flex items-end gap-2">
          <div class="flex-1">
            <BaseInput
              :id="`plan-asset-${index}`"
              v-model="line.asset_key"
              label="ISIN"
              placeholder="IE00B4L5Y983"
              :disabled="isSaving"
            />
          </div>
          <div class="w-28">
            <BaseInput
              :id="`plan-share-${index}`"
              v-model="line.share"
              type="number"
              label="%"
              placeholder="80"
              :disabled="isSaving"
            />
          </div>
          <BaseButton variant="secondary" :disabled="isSaving" @click="removeLine(index)">
            Retirer
          </BaseButton>
        </div>
        <div class="flex items-center gap-3">
          <BaseButton variant="secondary" :disabled="isSaving" @click="addLine">
            Ajouter une ligne
          </BaseButton>
          <span
            v-if="lines.length"
            :class="[
              'text-xs',
              Math.abs(allocationTotal - 100) > 1
                ? 'text-warning'
                : 'text-text-muted dark:text-text-dark-muted',
            ]"
          >
            Total : {{ allocationTotal }} %
          </span>
        </div>
      </div>

      <p v-if="localError" class="text-xs text-danger">{{ localError }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <BaseButton :disabled="isSaving" @click="save">Enregistrer</BaseButton>
        <BaseButton v-if="hasPlan" variant="secondary" :disabled="isSaving" @click="clear">
          Supprimer le plan
        </BaseButton>
      </div>
    </div>
  </div>
</template>
