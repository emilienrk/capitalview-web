<script setup lang="ts">
import { Check, Copy, Plug, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { BaseAlert, BaseBadge, BaseButton, BaseCard, BaseInput } from '@/components'
import PasswordCodeModal from '@/components/security/PasswordCodeModal.vue'
import SecretRevealModal from '@/components/security/SecretRevealModal.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useFormatters } from '@/composables/useFormatters'
import { useApiTokensStore } from '@/stores/apiTokens'
import { useAuthStore } from '@/stores/auth'

const tokensStore = useApiTokensStore()
const authStore = useAuthStore()
const { formatDate } = useFormatters()
const { confirmDialog } = useConfirm()

const tokenName = ref('')
const createModal = reactive({ open: false, loading: false, error: '' })
const reveal = reactive({ open: false, secrets: [] as string[] })
const listError = ref('')
const copied = ref(false)

const totpEnabled = computed(() => !!authStore.user?.totp_enabled)
const mcpUrl = computed(() => tokensStore.connection?.url ?? '')
const mcpEnabled = computed(() => tokensStore.connection?.enabled !== false)

onMounted(async () => {
  try {
    await Promise.all([tokensStore.fetchTokens(), tokensStore.fetchConnection()])
  } catch (e: any) {
    listError.value = e.message || 'Impossible de charger les tokens.'
  }
})

const clientConfig = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        capitalview: {
          type: 'http',
          url: mcpUrl.value,
          headers: { Authorization: 'Bearer VOTRE_TOKEN' },
        },
      },
    },
    null,
    2,
  ),
)

function openCreate() {
  createModal.error = ''
  createModal.open = true
}

async function handleCreate({ password, code }: { password: string; code: string }) {
  createModal.error = ''
  createModal.loading = true
  try {
    const created = await tokensStore.createToken({
      password,
      totp_code: totpEnabled.value ? code : undefined,
      name: tokenName.value.trim() || 'Client MCP',
    })
    createModal.open = false
    tokenName.value = ''
    reveal.secrets = [created.token]
    reveal.open = true
  } catch (e: any) {
    createModal.error = e.message || 'Erreur lors de la génération.'
  } finally {
    createModal.loading = false
  }
}

async function handleRevoke(uuid: string, name: string) {
  const ok = await confirmDialog({
    title: 'Révoquer ce token',
    message: `« ${name} » cessera de fonctionner immédiatement. Le client qui l'utilise perdra l'accès.`,
    confirmLabel: 'Révoquer',
    variant: 'danger',
  })
  if (!ok) return

  try {
    await tokensStore.revokeToken(uuid)
  } catch (e: any) {
    listError.value = e.message || 'Erreur lors de la révocation.'
  }
}

async function copyConfig() {
  try {
    await navigator.clipboard.writeText(clientConfig.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard unavailable — the block is selectable by hand
  }
}
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
          <Plug class="w-4 h-4 text-primary" stroke-width="2" />
        </div>
        <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Accès agents (MCP)</h3>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-text-muted dark:text-text-dark-muted">
        Connectez un assistant (Claude Desktop, Claude Code…) à CapitalView pour qu'il puisse
        consulter votre patrimoine, votre performance et votre budget. L'accès est en lecture
        seule : aucun outil ne peut modifier vos données.
      </p>

      <BaseAlert variant="warning">
        Un token donne accès à l'ensemble de vos chiffres, y compris vos données chiffrées.
        Traitez-le comme votre mot de passe : il n'est affiché qu'une seule fois, et il est
        révocable à tout moment ci-dessous.
      </BaseAlert>

      <BaseAlert v-if="!mcpEnabled" variant="info">
        Le serveur MCP est désactivé sur cette instance. Les tokens générés ne pourront pas
        s'y connecter tant qu'il ne sera pas réactivé.
      </BaseAlert>
      <BaseAlert v-if="listError" variant="danger">{{ listError }}</BaseAlert>

      <!-- Existing tokens -->
      <div v-if="tokensStore.tokens.length" class="divide-y divide-surface-border dark:divide-surface-dark-border border border-surface-border dark:border-surface-dark-border rounded-secondary">
        <div
          v-for="token in tokensStore.tokens"
          :key="token.uuid"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="font-medium text-text-main dark:text-text-dark-main truncate">{{ token.name }}</p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted">
              Créé le {{ formatDate(token.created_at) }}
              ·
              <template v-if="token.last_used_at">
                utilisé le {{ formatDate(token.last_used_at) }}
              </template>
              <template v-else>jamais utilisé</template>
              <template v-if="token.expires_at">
                · expire le {{ formatDate(token.expires_at) }}
              </template>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <BaseBadge variant="secondary">{{ token.scopes.join(' ') }}</BaseBadge>
            <BaseButton
              variant="ghost"
              size="sm"
              aria-label="Révoquer ce token"
              @click="handleRevoke(token.uuid, token.name)"
            >
              <Trash2 class="w-4 h-4 text-danger" />
            </BaseButton>
          </div>
        </div>
      </div>
      <p v-else-if="!tokensStore.isLoading" class="text-sm text-text-muted dark:text-text-dark-muted italic">
        Aucun token actif.
      </p>

      <!-- Mint -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-3">
        <BaseInput
          v-model="tokenName"
          label="Nom du token"
          placeholder="Claude Desktop"
          class="flex-1"
        />
        <BaseButton size="sm" @click="openCreate">Générer un token</BaseButton>
      </div>

      <!-- Client configuration -->
      <div v-if="mcpUrl" class="pt-4 border-t border-surface-border dark:border-surface-dark-border space-y-2">
        <div class="flex items-center justify-between gap-3">
          <p class="font-medium text-text-main dark:text-text-dark-main">Configuration du client</p>
          <BaseButton variant="outline" size="sm" @click="copyConfig">
            <Check v-if="copied" class="w-4 h-4 mr-1.5" />
            <Copy v-else class="w-4 h-4 mr-1.5" />
            {{ copied ? 'Copié' : 'Copier' }}
          </BaseButton>
        </div>
        <pre class="overflow-x-auto text-xs font-mono p-4 rounded-secondary bg-surface-alt dark:bg-surface-dark-alt border border-surface-border dark:border-surface-dark-border text-text-body dark:text-text-dark-body">{{ clientConfig }}</pre>
      </div>
    </div>

    <PasswordCodeModal
      :open="createModal.open"
      title="Générer un token d'accès"
      description="Confirmez votre identité pour générer un token. Il sera affiché une seule fois."
      submit-label="Générer"
      :require-code="totpEnabled"
      :loading="createModal.loading"
      :error="createModal.error"
      @close="createModal.open = false"
      @submit="handleCreate"
    />

    <SecretRevealModal
      :open="reveal.open"
      title="Votre token d'accès"
      description="Collez-le dans la configuration de votre client MCP. Il ne sera plus jamais affiché — en cas de perte, révoquez-le et générez-en un nouveau."
      :secrets="reveal.secrets"
      filename="capitalview-token-mcp.txt"
      @close="reveal.open = false"
    />
  </BaseCard>
</template>
