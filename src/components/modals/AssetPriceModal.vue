<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiClient } from '@/api/client'
import { getOrFetchCached } from '@/services/cache'
import { useDarkMode } from '@/composables/useDarkMode'
import { useFormatters } from '@/composables/useFormatters'
import { usePrivacyMode } from '@/composables/usePrivacyMode'
import type { AssetPriceTimelineResponse } from '@/types'
import AssetPriceHistoryChart from '@/components/charts/AssetPriceHistoryChart.vue'
import ChartPerformanceBadge from '@/components/charts/ChartPerformanceBadge.vue'
import { BaseEmptyState, BaseModal, BaseSpinner } from '@/components'

const props = defineProps<{
  open: boolean
  assetKey: string | null
  assetName?: string | null
  /** Restricts the trades shown to one account; omit to span every account. */
  accountId?: string | null
}>()

const emit = defineEmits<{ close: [] }>()

// The curve only moves once a day, so it is worth holding for a session rather
// than refetching every time the row is clicked.
const CACHE_TTL_MS = 60 * 60 * 1000

const { isDark } = useDarkMode()
const { formatNumber } = useFormatters()
const { maskValue } = usePrivacyMode()

const timeline = ref<AssetPriceTimelineResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const performance = ref<{ diff: number; percent: number | null } | null>(null)

const title = computed(() => props.assetName || timeline.value?.name || props.assetKey || 'Cours')

const tradeCount = computed(() => timeline.value?.events.length ?? 0)
const hasCurve = computed(() => (timeline.value?.points.length ?? 0) > 0)

/** Where the current price sits against what the position actually cost. */
const versusCostBasis = computed(() => {
  const current = Number(timeline.value?.current_price ?? NaN)
  const basis = Number(timeline.value?.average_buy_price ?? NaN)
  if (!Number.isFinite(current) || !Number.isFinite(basis) || basis <= 0) return null
  return ((current - basis) / basis) * 100
})

function formatPrice(value: number | null | undefined): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  const decimals = Math.abs(numeric) >= 1 ? 2 : 6
  return `${numeric.toLocaleString('fr-FR', { maximumFractionDigits: decimals })} €`
}

async function load(): Promise<void> {
  const assetKey = props.assetKey
  if (!assetKey) return

  isLoading.value = true
  error.value = null
  const query = props.accountId ? `?account_id=${encodeURIComponent(props.accountId)}` : ''

  try {
    timeline.value = await getOrFetchCached(
      `market:timeline:${assetKey}:${props.accountId ?? 'all'}`,
      () => apiClient.get<AssetPriceTimelineResponse>(
        `/market/assets/${encodeURIComponent(assetKey)}/price-timeline${query}`,
      ),
      CACHE_TTL_MS,
    )
  } catch (e) {
    timeline.value = null
    error.value = e instanceof Error ? e.message : "Impossible de charger le cours de l'actif"
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.open, props.assetKey, props.accountId],
  ([isOpen]) => {
    if (!isOpen) return
    performance.value = null
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :open="open" size="xl" @close="emit('close')">
    <template #header>
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-text-main dark:text-text-dark-main truncate">
          {{ title }}
        </h2>
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          Cours depuis votre premier achat
        </p>
      </div>
    </template>

    <div v-if="isLoading" class="h-80 flex items-center justify-center">
      <BaseSpinner size="md" label="Chargement du cours..." />
    </div>

    <BaseEmptyState
      v-else-if="error"
      title="Cours indisponible"
      :description="error"
    />

    <BaseEmptyState
      v-else-if="!hasCurve"
      title="Pas d'historique de cours"
      description="Aucun prix n'est encore enregistré pour cet actif — il apparaîtra après la prochaine récupération des cours."
    />

    <div v-else-if="timeline" class="space-y-4">
      <!-- Stat row: what the curve is worth now against what it cost -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted">Cours actuel</p>
          <p class="text-sm font-semibold text-text-main dark:text-text-dark-main">
            {{ formatPrice(timeline.current_price) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted">Prix de revient</p>
          <p class="text-sm font-semibold text-text-main dark:text-text-dark-main">
            {{ formatPrice(timeline.average_buy_price) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted">Écart au PRU</p>
          <p
            v-if="versusCostBasis !== null"
            :class="['text-sm font-semibold', versusCostBasis >= 0 ? 'text-success' : 'text-danger']"
          >
            {{ versusCostBasis >= 0 ? '+' : '' }}{{ versusCostBasis.toFixed(2) }} %
          </p>
          <p v-else class="text-sm font-semibold text-text-muted dark:text-text-dark-muted">—</p>
        </div>
        <div>
          <p class="text-xs text-text-muted dark:text-text-dark-muted">Quantité</p>
          <p class="text-sm font-semibold text-text-main dark:text-text-dark-main">
            {{ maskValue(formatNumber(timeline.quantity_held, 6)) }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <p class="text-xs text-text-muted dark:text-text-dark-muted">
          {{ tradeCount }} opération{{ tradeCount > 1 ? 's' : '' }} sur la période
        </p>
        <ChartPerformanceBadge :performance="performance" />
      </div>

      <AssetPriceHistoryChart
        :timeline="timeline"
        :is-dark="isDark"
        @update:performance="performance = $event"
      />

      <p class="text-[11px] leading-relaxed text-text-muted dark:text-text-dark-muted">
        La taille de chaque point suit le montant de l'opération. La ligne pointillée est votre
        prix de revient unitaire : au-dessus, la position est en plus-value.
      </p>
    </div>
  </BaseModal>
</template>
