<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { BaseAlert, BaseButton } from '@/components'
import PasswordCodeModal from '@/components/security/PasswordCodeModal.vue'
import SettingsSection from '@/pages/settings/SettingsSection.vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const deleteModal = reactive({ open: false, loading: false, error: '' })

const totpEnabled = computed(() => !!authStore.user?.totp_enabled)
const username = computed(() => authStore.user?.username ?? '')
const aiEnabled = computed(() => !!settingsStore.settings?.ai_feature_enabled)

async function handleDelete({ password, code, confirm }: { password: string; code: string; confirm: string }) {
  deleteModal.error = ''
  deleteModal.loading = true

  try {
    await authStore.deleteAccount({
      password,
      totp_code: totpEnabled.value ? code : undefined,
      confirm_username: confirm,
    })
    deleteModal.open = false
    router.push('/login')
  } catch (e: any) {
    deleteModal.error = e.message || 'Erreur lors de la suppression.'
  } finally {
    deleteModal.loading = false
  }
}
</script>

<template>
  <SettingsSection
    :icon="Trash2"
    title="Supprimer mon compte"
    subtitle="Immédiat et définitif : ni corbeille, ni délai, ni sauvegarde restaurable."
  >
    <div class="flex justify-end">
      <BaseButton variant="danger" size="sm" @click="deleteModal.open = true">
        Supprimer définitivement mon compte
      </BaseButton>
    </div>

    <PasswordCodeModal
      :open="deleteModal.open"
      title="Supprimer votre compte"
      description="Vos données sont chiffrées avec votre mot de passe : une fois effacées, personne — nous compris — ne peut les récupérer."
      submit-label="Supprimer mon compte"
      danger
      :require-code="totpEnabled"
      :confirm-value="username"
      confirm-label="Saisissez votre nom d'utilisateur"
      :loading="deleteModal.loading"
      :error="deleteModal.error"
      @close="deleteModal.open = false"
      @submit="handleDelete"
    >
      <template #details>
        <BaseAlert variant="warning">
          Sont supprimés : vos comptes bancaires, comptes titres et crypto avec toutes leurs
          transactions, vos cashflows, votre patrimoine et ses valorisations, vos notes, votre
          historique de valorisation, vos paramètres, votre profil communauté et vos tokens
          d'agent. Votre nom d'utilisateur et votre email redeviennent disponibles.
        </BaseAlert>

        <BaseAlert v-if="aiEnabled" variant="info">
          Les données déjà transmises à vos fournisseurs d'IA via vos propres clés API ne peuvent
          pas être rappelées : leur conservation dépend de ces fournisseurs, pas de CapitalView.
        </BaseAlert>

        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Pensez à télécharger vos données avant de continuer — après, ce ne sera plus possible.
        </p>
      </template>
    </PasswordCodeModal>
  </SettingsSection>
</template>
