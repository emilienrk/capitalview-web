<script setup lang="ts">
import { Bitcoin, LayoutGrid, RefreshCw } from 'lucide-vue-next'

import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { BaseAlert, BaseHelpPopover, BaseSkeleton, BaseToggle } from '@/components'
import SettingsSection from './SettingsSection.vue'
import type { UserSettingsUpdate } from '@/types'

const settingsStore = useSettingsStore()

// Module toggles
const bankModuleEnabled = ref(true)
const bankAutoSyncEnabled = ref(true)
const cashflowModuleEnabled = ref(true)
const wealthModuleEnabled = ref(true)
const notesModuleEnabled = ref(false)

// Crypto settings
const cryptoModuleEnabled = ref(false)
const cryptoAutoDeposits = ref(false)
const cryptoMode = ref<'SINGLE' | 'MULTI'>('SINGLE')

const errorMessage = ref<string | null>(null)

function syncFromStore(): void {
  const settings = settingsStore.settings
  if (!settings) return
  bankModuleEnabled.value = settings.bank_module_enabled ?? true
  bankAutoSyncEnabled.value = settings.bank_auto_sync_enabled ?? false
  cashflowModuleEnabled.value = settings.cashflow_module_enabled ?? true
  wealthModuleEnabled.value = settings.wealth_module_enabled ?? true
  notesModuleEnabled.value = settings.notes_module_enabled ?? false
  cryptoModuleEnabled.value = settings.crypto_module_enabled
  cryptoAutoDeposits.value = settings.crypto_auto_deposits ?? false
  cryptoMode.value = settings.crypto_mode
}

/**
 * The store may still be loading when this tab mounts (child `mounted` hooks run
 * before the parent's fetch), so sync on every settings change, not just once.
 */
watch(() => settingsStore.settings, syncFromStore, { immediate: true })

/** Save immediately, and put the controls back on the stored values if it fails. */
async function save(patch: UserSettingsUpdate): Promise<void> {
  errorMessage.value = null
  const success = await settingsStore.updateSettings(patch)
  if (!success) {
    errorMessage.value = settingsStore.error ?? 'Une erreur est survenue lors de l\'enregistrement.'
    syncFromStore()
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Modules -->
    <SettingsSection
      :icon="LayoutGrid"
      title="Modules d'affichage"
      description="Choisissez les modules à afficher dans la navigation. Chaque changement est enregistré aussitôt."
    >
      <template v-if="settingsStore.isLoading && !settingsStore.settings">
        <div class="space-y-4">
          <BaseSkeleton v-for="i in 4" :key="i" variant="rect" height="2.5rem" />
        </div>
      </template>
      <template v-else>
        <div class="space-y-5">
          <!-- Compte Bancaire -->
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Compte Bancaire</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Affiche la gestion des comptes bancaires</p>
            </div>
            <BaseToggle
              v-model="bankModuleEnabled"
              aria-label="Activer le module Banque"
              @update:model-value="save({ bank_module_enabled: $event })"
            />
          </div>

          <!-- Bank auto-sync -->
          <div v-if="bankModuleEnabled" class="flex items-center justify-between gap-4 pl-4 border-l-2 border-surface-border dark:border-surface-dark-border">
            <div class="flex items-start gap-2">
              <RefreshCw class="w-4 h-4 mt-0.5 shrink-0 text-text-muted dark:text-text-dark-muted" />
              <div>
                <div class="flex items-center gap-1">
                  <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Synchronisation automatique</p>
                  <BaseHelpPopover width="md">
                    À chaque échéance, ajoute au solde du compte les entrées récurrentes qui lui sont
                    rattachées dans Cashflow, et en retire les dépenses récurrentes. Rien d'autre :
                    les dépenses ponctuelles n'y sont pas, donc le solde s'éloigne peu à peu de
                    celui de la banque et doit être recalé à la main de temps en temps. Sans effet
                    sur un compte relié à la banque.
                  </BaseHelpPopover>
                </div>
                <p class="text-sm text-text-muted dark:text-text-dark-muted">Applique les flux récurrents aux soldes de vos comptes</p>
              </div>
            </div>
            <BaseToggle
              v-model="bankAutoSyncEnabled"
              aria-label="Activer la synchronisation automatique des comptes bancaires"
              @update:model-value="save({ bank_auto_sync_enabled: $event })"
            />
          </div>

          <!-- Cashflow -->
          <div class="flex items-center justify-between pt-4 border-t border-surface-border dark:border-surface-dark-border">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Cashflow</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Affiche le suivi des flux de trésorerie</p>
            </div>
            <BaseToggle
              v-model="cashflowModuleEnabled"
              aria-label="Activer le module Flux de trésorerie"
              @update:model-value="save({ cashflow_module_enabled: $event })"
            />
          </div>

          <!-- Patrimoine -->
          <div class="flex items-center justify-between pt-4 border-t border-surface-border dark:border-surface-dark-border">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Patrimoine</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Affiche la gestion du patrimoine</p>
            </div>
            <BaseToggle
              v-model="wealthModuleEnabled"
              aria-label="Activer le module Patrimoine"
              @update:model-value="save({ wealth_module_enabled: $event })"
            />
          </div>

          <!-- Notes -->
          <div class="flex items-center justify-between pt-4 border-t border-surface-border dark:border-surface-dark-border">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Notes</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Affiche un bloc-notes chiffré pour vos mémos</p>
            </div>
            <BaseToggle
              v-model="notesModuleEnabled"
              aria-label="Activer le module Notes"
              @update:model-value="save({ notes_module_enabled: $event })"
            />
          </div>
        </div>
      </template>
    </SettingsSection>

    <!-- Crypto Module -->
    <SettingsSection
      :icon="Bitcoin"
      title="Module Crypto"
      description="Activez et configurez le suivi de vos crypto-monnaies."
    >
      <template v-if="settingsStore.isLoading && !settingsStore.settings">
        <div class="space-y-4">
          <BaseSkeleton variant="rect" height="2.5rem" />
        </div>
      </template>
      <template v-else>
        <div class="space-y-5">
          <!-- Enable toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-text-main dark:text-text-dark-main">Activer le module Crypto</p>
              <p class="text-sm text-text-muted dark:text-text-dark-muted">Affiche l'entrée Crypto dans la navigation</p>
            </div>
            <BaseToggle
              v-model="cryptoModuleEnabled"
              aria-label="Activer le module Crypto"
              @update:model-value="save({ crypto_module_enabled: $event })"
            />
          </div>

          <!-- Crypto sub-settings (only when enabled) -->
          <Transition name="cv-expand">
            <div v-if="cryptoModuleEnabled">
              <div>
                <div class="space-y-6 pt-3 border-t border-surface-border dark:border-surface-dark-border">
                  <div class="space-y-3">
                    <p class="text-sm font-medium text-text-main dark:text-text-dark-main">Mode de gestion</p>
    
                    <label :class="['flex items-start gap-3 p-4 rounded-card border-2 cursor-pointer transition-colors', cryptoMode === 'SINGLE' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-surface-border dark:border-surface-dark-border hover:border-primary/40']">
                      <input type="radio" name="cryptoMode" value="SINGLE" v-model="cryptoMode" class="mt-0.5 accent-primary shrink-0" @change="save({ crypto_mode: 'SINGLE' })" />
                      <div>
                        <p class="font-medium text-text-main dark:text-text-dark-main">
                          Patrimoine Global
                          <span class="ml-2 text-xs font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded-secondary">Recommandé</span>
                        </p>
                        <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">Vue centralisée de toutes vos crypto-monnaies.</p>
                      </div>
                    </label>
    
                    <label :class="['flex items-start gap-3 p-4 rounded-card border-2 cursor-pointer transition-colors', cryptoMode === 'MULTI' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-surface-border dark:border-surface-dark-border hover:border-primary/40']">
                      <input type="radio" name="cryptoMode" value="MULTI" v-model="cryptoMode" class="mt-0.5 accent-primary shrink-0" @change="save({ crypto_mode: 'MULTI' })" />
                      <div>
                        <p class="font-medium text-text-main dark:text-text-dark-main">
                          Gestion Multi-Comptes
                          <span class="ml-2 text-xs font-medium uppercase tracking-wide bg-surface-border dark:bg-surface-dark-border text-text-muted dark:text-text-dark-muted px-1.5 py-0.5 rounded-secondary">Avancé</span>
                        </p>
                        <p class="text-sm text-text-muted dark:text-text-dark-muted mt-0.5">Séparez vos portefeuilles par exchange ou cold wallet.</p>
                      </div>
                    </label>
                  </div>
    
                  <div class="pt-4 border-t border-surface-border dark:border-surface-dark-border">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="flex items-center gap-1">
                          <p class="font-medium text-text-main dark:text-text-dark-main">Dépôts automatiques</p>
                          <BaseHelpPopover width="md">
                            Activés, vos achats sont considérés comme payés par des virements en euros
                            que vous n'avez pas à saisir : aucune ligne en euros n'apparaît sur le
                            compte, et votre patrimoine reste juste. Les euros issus d'une vente restent
                            affichés. Désactivés, vous saisissez vos dépôts vous-même ; s'il en manque,
                            le solde en euros passe sous zéro, marqué « apports non saisis ».
                          </BaseHelpPopover>
                        </div>
                        <p class="text-sm text-text-muted dark:text-text-dark-muted">Suivre vos cryptos sans saisir vos dépôts en euros</p>
                      </div>
                      <BaseToggle
                        v-model="cryptoAutoDeposits"
                        aria-label="Dépôts automatiques"
                        @update:model-value="save({ crypto_auto_deposits: $event })"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </SettingsSection>

    <BaseAlert v-if="errorMessage" variant="danger" dismissible @dismiss="errorMessage = null">
      {{ errorMessage }}
    </BaseAlert>
  </div>
</template>
