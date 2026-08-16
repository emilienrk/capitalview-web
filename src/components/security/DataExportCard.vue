<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { ref } from 'vue'
import { BaseAlert, BaseButton } from '@/components'
import SettingsSection from '@/pages/settings/SettingsSection.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isExporting = ref(false)
const error = ref('')
const success = ref('')

function filename(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `capitalview-donnees-${today}.json`
}

async function handleExport(): Promise<void> {
  error.value = ''
  success.value = ''
  isExporting.value = true

  try {
    const data = await authStore.exportData()

    // Same client-side download as the secret reveal modal: the API answers
    // with JSON, so there is nothing binary to stream.
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename()
    a.click()
    URL.revokeObjectURL(url)

    success.value = 'Export téléchargé.'
    setTimeout(() => { success.value = '' }, 5000)
  } catch (e: any) {
    error.value = e.message || "Impossible de générer l'export."
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <SettingsSection :icon="Download" title="Mes données">
    <div class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        Téléchargez l'intégralité de votre compte dans un fichier JSON : comptes bancaires, bourse,
        crypto, cashflows, patrimoine, notes, paramètres et historique de valorisation. Les données
        sont déchiffrées au moment de l'export — le fichier est donc lisible en clair, conservez-le
        en lieu sûr.
      </p>

      <BaseAlert variant="info">
        Vos identifiants de connexion ne sont pas inclus (mot de passe, clés de chiffrement, secret
        2FA, tokens d'agent) : ce sont des accès à votre compte, pas des données personnelles.
      </BaseAlert>

      <BaseAlert v-if="error" variant="danger">{{ error }}</BaseAlert>
      <BaseAlert v-if="success" variant="success">{{ success }}</BaseAlert>

      <div class="flex justify-end">
        <BaseButton variant="outline" size="sm" :loading="isExporting" @click="handleExport">
          Télécharger mes données
        </BaseButton>
      </div>
    </div>
  </SettingsSection>
</template>
