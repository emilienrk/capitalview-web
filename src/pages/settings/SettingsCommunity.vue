<script setup lang="ts">
import { List, Lock, User } from 'lucide-vue-next'

import { nextTick, onMounted, ref, computed } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useAuthStore } from '@/stores/auth'
import { BaseButton, BaseInput, BaseAlert, BaseSkeleton, BaseTextarea, BaseToggle } from '@/components'
import SettingsSection from './SettingsSection.vue'

const communityStore = useCommunityStore()
const auth = useAuthStore()

// Profile fields
const communityActive = ref(false)
const isPrivate = ref(true)
const displayName = ref('')
const bio = ref('')

// Position selection
const selectedStockIsins = ref<Set<string>>(new Set())
const selectedCryptoSymbols = ref<Set<string>>(new Set())

// Save state
const isSaving = ref(false)
const saveSuccess = ref(false)

const isLoading = computed(() => communityStore.isLoadingSettings || communityStore.isLoadingPositions)

// Unlike the other tabs, this one saves on demand: flag what the button would
// send, so leaving the tab with a toggle flipped doesn't look like it stuck.
function formSnapshot(): string {
  return JSON.stringify([
    communityActive.value,
    isPrivate.value,
    displayName.value.trim(),
    bio.value.trim(),
    [...selectedStockIsins.value].sort(),
    [...selectedCryptoSymbols.value].sort(),
  ])
}
const savedSnapshot = ref<string | null>(null)
// The stored values land after the first render; revealing them is not something
// the user did, so the profile blocks only animate once they are in place.
const animateReveal = ref(false)
const isDirty = computed(() => savedSnapshot.value !== null && formSnapshot() !== savedSnapshot.value)

onMounted(async () => {
  // Load settings and available positions in parallel
  await Promise.all([
    communityStore.fetchSettings(),
    communityStore.fetchAvailablePositions(),
  ])

  if (communityStore.settings) {
    communityActive.value = communityStore.settings.is_active
    isPrivate.value = communityStore.settings.is_private
    displayName.value = communityStore.settings.display_name ?? ''
    bio.value = communityStore.settings.bio ?? ''
    selectedStockIsins.value = new Set(communityStore.settings.shared_stock_asset_keys)
    selectedCryptoSymbols.value = new Set(communityStore.settings.shared_crypto_asset_keys)
  }
  savedSnapshot.value = formSnapshot()
  await nextTick()
  animateReveal.value = true
})

function toggleStock(asset_key: string): void {
  if (selectedStockIsins.value.has(asset_key)) {
    selectedStockIsins.value.delete(asset_key)
  } else {
    selectedStockIsins.value.add(asset_key)
  }
  // Force reactivity
  selectedStockIsins.value = new Set(selectedStockIsins.value)
}

function toggleCrypto(symbol: string): void {
  if (selectedCryptoSymbols.value.has(symbol)) {
    selectedCryptoSymbols.value.delete(symbol)
  } else {
    selectedCryptoSymbols.value.add(symbol)
  }
  selectedCryptoSymbols.value = new Set(selectedCryptoSymbols.value)
}

function selectAllStocks(): void {
  if (!communityStore.availablePositions) return
  selectedStockIsins.value = new Set(communityStore.availablePositions.stocks.map(s => s.asset_key))
}

function deselectAllStocks(): void {
  selectedStockIsins.value = new Set()
}

function selectAllCrypto(): void {
  if (!communityStore.availablePositions) return
  selectedCryptoSymbols.value = new Set(communityStore.availablePositions.crypto.map(c => c.asset_key))
}

function deselectAllCrypto(): void {
  selectedCryptoSymbols.value = new Set()
}

async function save(): Promise<void> {
  isSaving.value = true
  saveSuccess.value = false
  const success = await communityStore.updateSettings({
    is_active: communityActive.value,
    is_private: isPrivate.value,
    display_name: displayName.value.trim() || null,
    bio: bio.value.trim() || null,
    shared_stock_asset_keys: [...selectedStockIsins.value],
    shared_crypto_asset_keys: [...selectedCryptoSymbols.value],
  })
  isSaving.value = false
  if (success) {
    savedSnapshot.value = formSnapshot()
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  }
}

const totalSelected = computed(() => selectedStockIsins.value.size + selectedCryptoSymbols.value.size)
</script>

<template>
  <div class="space-y-6">
    <!-- Profile Card -->
    <SettingsSection :icon="User" title="Profil communautaire">

      <template v-if="isLoading && !communityStore.settings">
        <div class="space-y-4">
          <BaseSkeleton variant="rect" height="2.5rem" />
          <BaseSkeleton variant="rect" height="2.5rem" />
          <BaseSkeleton variant="rect" height="5rem" />
        </div>
      </template>

      <template v-else>
        <p class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
          Personnalisez votre profil public. Seul votre PnL (%) sera visible.
          Aucun montant ni quantité ne sera partagé.
        </p>

        <div class="space-y-5">
          <!-- Enable toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Activer le profil</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">
                Votre profil sera visible par les utilisateurs connectés
              </p>
            </div>
            <BaseToggle v-model="communityActive" aria-label="Rejoindre la communauté" />
          </div>

          <!-- Profile details, shown once the profile is active. -->
          <Transition name="cv-expand" :css="animateReveal">
            <div v-if="communityActive">
              <div>
                <div class="space-y-5">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="font-medium text-text-main dark:text-text-dark-main flex items-center gap-2">
                        <Lock class="w-4 h-4" stroke-width="2" />
                        Compte privé
                      </p>
                      <p class="text-sm text-text-muted dark:text-text-dark-muted">
                        Votre profil n'apparaîtra que si on recherche votre pseudo exact. Vos positions ne seront visibles qu'aux abonnés mutuels.
                      </p>
                    </div>
                    <BaseToggle v-model="isPrivate" aria-label="Profil privé" />
                  </div>

                  <div class="space-y-4 pt-4 border-t border-surface-border dark:border-surface-dark-border">
                    <!-- Preview avatar + username -->
                    <div class="flex items-center gap-3 p-3 rounded-card bg-background-subtle dark:bg-surface-dark">
                      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span class="text-primary text-lg font-bold">
                          {{ (displayName || auth.user?.username || '?').charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div>
                        <p class="font-medium text-text-main dark:text-text-dark-main">
                          {{ displayName || auth.user?.username }}
                        </p>
                        <p v-if="bio" class="text-sm text-text-muted dark:text-text-dark-muted line-clamp-1">{{ bio }}</p>
                      </div>
                    </div>

                    <BaseInput
                      v-model="displayName"
                      label="Nom d'affichage (optionnel)"
                      placeholder="Par défaut : votre nom d'utilisateur"
                      maxlength="100"
                    />
                    <BaseTextarea
                      v-model="bio"
                      label="Bio (optionnel)"
                      :rows="3"
                      placeholder="Présentez-vous en quelques mots..."
                      maxlength="500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </SettingsSection>

    <!-- Position Selection -->
    <Transition
      :css="animateReveal"
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <SettingsSection
        v-if="communityActive"
        :icon="List"
        title="Positions partagées"
        :subtitle="totalSelected > 0 ? `${totalSelected} position(s) sélectionnée(s)` : undefined"
      >

        <template v-if="communityStore.isLoadingPositions">
          <div class="space-y-3">
            <BaseSkeleton v-for="i in 4" :key="i" variant="rect" height="2.5rem" />
          </div>
        </template>

        <template v-else-if="!communityStore.availablePositions || (communityStore.availablePositions.stocks.length === 0 && communityStore.availablePositions.crypto.length === 0)">
          <div class="text-center py-6">
            <p class="text-text-muted dark:text-text-dark-muted">
              Aucune position disponible à partager.
            </p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted mt-1">
              Ajoutez des transactions dans vos comptes Bourse ou Crypto pour qu'elles apparaissent ici.
            </p>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-text-muted dark:text-text-dark-muted mb-4">
            Cochez les positions dont vous souhaitez partager le PnL (%).
          </p>

          <!-- Stocks -->
          <div v-if="communityStore.availablePositions.stocks.length > 0" class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold text-text-main dark:text-text-dark-main flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-primary"></span>
                Actions ({{ communityStore.availablePositions.stocks.length }})
              </p>
              <div class="flex gap-2 text-xs">
                <button
                  type="button"
                  @click="selectAllStocks"
                  class="py-2.5 -my-2.5 text-primary hover:underline"
                >
                  Tout cocher
                </button>
                <span class="text-text-muted dark:text-text-dark-muted">|</span>
                <button
                  type="button"
                  @click="deselectAllStocks"
                  class="py-2.5 -my-2.5 text-text-muted dark:text-text-dark-muted hover:text-danger"
                >
                  Tout décocher
                </button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                v-for="pos in communityStore.availablePositions.stocks"
                :key="pos.asset_key"
                :class="[
                  'flex items-center gap-3 p-3 rounded-card border cursor-pointer transition-colors',
                  selectedStockIsins.has(pos.asset_key)
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-surface-border dark:border-surface-dark-border hover:border-primary/40',
                ]"
              >
                <input
                  type="checkbox"
                  :checked="selectedStockIsins.has(pos.asset_key)"
                  @change="toggleStock(pos.asset_key)"
                  class="accent-primary shrink-0 w-4 h-4"
                />
                <div class="min-w-0">
                  <p class="font-medium text-sm text-text-main dark:text-text-dark-main truncate">{{ pos.name || pos.asset_key }}</p>
                  <p v-if="pos.name" class="text-xs text-text-muted dark:text-text-dark-muted">{{ pos.asset_key }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Crypto -->
          <div v-if="communityStore.availablePositions.crypto.length > 0">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold text-text-main dark:text-text-dark-main flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-info"></span>
                Crypto ({{ communityStore.availablePositions.crypto.length }})
              </p>
              <div class="flex gap-2 text-xs">
                <button
                  type="button"
                  @click="selectAllCrypto"
                  class="py-2.5 -my-2.5 text-primary hover:underline"
                >
                  Tout cocher
                </button>
                <span class="text-text-muted dark:text-text-dark-muted">|</span>
                <button
                  type="button"
                  @click="deselectAllCrypto"
                  class="py-2.5 -my-2.5 text-text-muted dark:text-text-dark-muted hover:text-danger"
                >
                  Tout décocher
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label
                v-for="pos in communityStore.availablePositions.crypto"
                :key="pos.asset_key"
                :class="[
                  'flex items-center gap-3 p-3 rounded-card border cursor-pointer transition-colors',
                  selectedCryptoSymbols.has(pos.asset_key)
                    ? 'border-info bg-info/5 dark:bg-info/10'
                    : 'border-surface-border dark:border-surface-dark-border hover:border-info/40',
                ]"
              >
                <input
                  type="checkbox"
                  :checked="selectedCryptoSymbols.has(pos.asset_key)"
                  @change="toggleCrypto(pos.asset_key)"
                  class="accent-primary shrink-0 w-4 h-4"
                />
                <span class="font-medium text-sm text-text-main dark:text-text-dark-main">{{ pos.asset_key }}</span>
              </label>
            </div>
          </div>
        </template>
      </SettingsSection>
    </Transition>

    <!-- Save button -->
    <div class="flex items-center justify-end gap-4">
      <BaseAlert v-if="communityStore.error" variant="danger" class="flex-1 py-1.5!">
        {{ communityStore.error }}
      </BaseAlert>
      <BaseAlert v-else-if="saveSuccess" variant="success" class="flex-1 py-1.5!">
        Paramètres communautaires sauvegardés.
      </BaseAlert>
      <p v-else-if="isDirty" class="text-sm text-warning">Modifications non enregistrées</p>
      <BaseButton @click="save" :loading="isSaving" :disabled="!isDirty" size="sm" class="shrink-0">
        Enregistrer
      </BaseButton>
    </div>
  </div>
</template>
