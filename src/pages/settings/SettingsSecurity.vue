<script setup lang="ts">
import { Lock, User as UserIcon, Mail, KeyRound, ShieldCheck, LifeBuoy } from 'lucide-vue-next'
import { ref, reactive, onMounted, computed } from 'vue'
import { BaseCard, BaseButton, BaseInput, BaseAlert, BaseBadge } from '@/components'
import TwoFactorSetupModal from '@/components/security/TwoFactorSetupModal.vue'
import PasswordCodeModal from '@/components/security/PasswordCodeModal.vue'
import SecretRevealModal from '@/components/security/SecretRevealModal.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const newUsername = ref('')
const newEmail = ref('')

const isSavingUsername = ref(false)
const usernameError = ref('')
const usernameSuccess = ref('')

const isSavingEmail = ref(false)
const emailError = ref('')
const emailSuccess = ref('')

// ── Password change ──────────────────────────────────────────
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordTotp = ref('')
const isSavingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

// ── 2FA ──────────────────────────────────────────────────────
const showSetupModal = ref(false)
const disableModal = reactive({ open: false, loading: false, error: '' })
const regenModal = reactive({ open: false, loading: false, error: '' })

// ── Recovery key ─────────────────────────────────────────────
const recoveryModal = reactive({ open: false, loading: false, error: '' })

// ── One-time secret reveal ───────────────────────────────────
const reveal = reactive({
  open: false,
  title: '',
  description: '',
  secrets: [] as string[],
  filename: 'capitalview-secrets.txt',
})

const totpEnabled = computed(() => !!authStore.user?.totp_enabled)

onMounted(() => {
  if (authStore.user) {
    newUsername.value = authStore.user.username
    newEmail.value = authStore.user.email
  }
})

// Calculate days since last change
const hasChangedUsername = computed(() => !!authStore.user?.last_username_change)

const daysSinceEmailChange = computed(() => {
  if (!authStore.user?.last_email_change) return null
  const diffTime = Math.abs(new Date().getTime() - new Date(authStore.user.last_email_change).getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
})

const isEmailLocked = computed(() => {
  if (daysSinceEmailChange.value === null) return false
  return daysSinceEmailChange.value < 30
})

const emailLockMessage = computed(() => {
  if (!isEmailLocked.value || daysSinceEmailChange.value === null) return ''
  const daysLeft = 30 - daysSinceEmailChange.value
  return `Vous devez attendre ${daysLeft} jour(s) avant de pouvoir modifier à nouveau votre email.`
})

const passwordsMatch = computed(() => newPassword.value === confirmPassword.value)
const canSubmitPassword = computed(() =>
  !!currentPassword.value &&
  newPassword.value.length >= 8 &&
  passwordsMatch.value &&
  (!totpEnabled.value || !!passwordTotp.value),
)

async function handleUsernameChange() {
  usernameError.value = ''
  usernameSuccess.value = ''

  if (!newUsername.value || newUsername.value === authStore.user?.username) {
    return
  }

  isSavingUsername.value = true
  try {
    await authStore.updateProfile({ username: newUsername.value })
    usernameSuccess.value = "Nom d'utilisateur mis à jour avec succès."
    setTimeout(() => { usernameSuccess.value = '' }, 5000)
  } catch (error: any) {
    usernameError.value = error.message || "Erreur lors de la mise à jour."
  } finally {
    isSavingUsername.value = false
  }
}

async function handleEmailChange() {
  emailError.value = ''
  emailSuccess.value = ''

  if (!newEmail.value || newEmail.value === authStore.user?.email) {
    return
  }

  isSavingEmail.value = true
  try {
    await authStore.updateProfile({ email: newEmail.value })
    emailSuccess.value = "Adresse email mise à jour avec succès."
    setTimeout(() => { emailSuccess.value = '' }, 5000)
  } catch (error: any) {
    emailError.value = error.message || "Erreur lors de la mise à jour."
  } finally {
    isSavingEmail.value = false
  }
}

async function handlePasswordChange() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!passwordsMatch.value) {
    passwordError.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  isSavingPassword.value = true
  try {
    await authStore.changePassword({
      current_password: currentPassword.value,
      new_password: newPassword.value,
      totp_code: totpEnabled.value ? passwordTotp.value.trim() : undefined,
    })
    passwordSuccess.value = 'Mot de passe modifié avec succès. Vos autres sessions ont été déconnectées.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordTotp.value = ''
    setTimeout(() => { passwordSuccess.value = '' }, 6000)
  } catch (error: any) {
    passwordError.value = error.message || 'Erreur lors de la modification.'
  } finally {
    isSavingPassword.value = false
  }
}

// ── 2FA handlers ─────────────────────────────────────────────
function openReveal(opts: { title: string; description: string; secrets: string[]; filename: string }) {
  reveal.title = opts.title
  reveal.description = opts.description
  reveal.secrets = opts.secrets
  reveal.filename = opts.filename
  reveal.open = true
}

function on2faEnabled(codes: string[]) {
  showSetupModal.value = false
  openReveal({
    title: 'Codes de secours',
    description: 'Utilisez-les pour vous connecter si vous perdez votre application d\'authentification. Chaque code ne fonctionne qu\'une seule fois.',
    secrets: codes,
    filename: 'capitalview-recovery-keys.txt',
  })
}

async function handleDisable2fa({ password, code }: { password: string; code: string }) {
  disableModal.error = ''
  disableModal.loading = true
  try {
    await authStore.disable2fa(password, code)
    disableModal.open = false
  } catch (e: any) {
    disableModal.error = e.message || 'Erreur lors de la désactivation.'
  } finally {
    disableModal.loading = false
  }
}

async function handleRegenBackupCodes({ password, code }: { password: string; code: string }) {
  regenModal.error = ''
  regenModal.loading = true
  try {
    const codes = await authStore.regenerateBackupCodes(password, code)
    regenModal.open = false
    openReveal({
      title: 'Nouveaux codes de secours',
      description: 'Vos anciens codes ne fonctionnent plus. Chaque nouveau code ne fonctionne qu\'une seule fois.',
      secrets: codes,
      filename: 'capitalview-recovery-keys.txt',
    })
  } catch (e: any) {
    regenModal.error = e.message || 'Erreur lors de la régénération.'
  } finally {
    regenModal.loading = false
  }
}

async function handleGenerateRecoveryKey({ password }: { password: string }) {
  recoveryModal.error = ''
  recoveryModal.loading = true
  try {
    const key = await authStore.generateRecoveryKey(password)
    recoveryModal.open = false
    openReveal({
      title: 'Clé de récupération',
      description: 'Conservez cette clé hors ligne. Elle permet de réinitialiser votre mot de passe sans perdre vos données chiffrées. Elle est à usage unique.',
      secrets: [key],
      filename: 'capitalview-cle-recuperation.txt',
    })
  } catch (e: any) {
    recoveryModal.error = e.message || 'Erreur lors de la génération.'
  } finally {
    recoveryModal.loading = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- ── Profile (username / email) ──────────────────── -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <Lock class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Sécurité & Profil</h3>
        </div>
      </template>
      <div class="space-y-8">
        <!-- Encryption status -->
        <div class="flex items-center gap-2 pb-6 border-b border-surface-border dark:border-surface-dark-border">
          <div class="w-2 h-2 rounded-full bg-success shrink-0" />
          <span class="text-sm text-text-body dark:text-text-dark-body">Chiffrement des données actif — vos informations sensibles sont protégées</span>
        </div>

        <!-- Username change form -->
        <div class="space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <UserIcon class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
              <p class="font-medium text-text-main dark:text-text-dark-main">Nom d'utilisateur</p>
            </div>
          </div>

          <BaseAlert v-if="usernameError" variant="danger">{{ usernameError }}</BaseAlert>
          <BaseAlert v-if="usernameSuccess" variant="success">{{ usernameSuccess }}</BaseAlert>

          <div v-if="hasChangedUsername" class="px-4 py-3 bg-surface-alt dark:bg-surface-dark-alt rounded-secondary border border-surface-border dark:border-surface-dark-border">
            <p class="text-text-main dark:text-text-dark-main font-medium">{{ authStore.user?.username }}</p>
            <p class="text-sm text-text-muted dark:text-text-dark-muted mt-1">
              Vous avez déjà modifié votre nom d'utilisateur. Cette action n'est plus possible.
            </p>
          </div>
          <div v-else>
            <BaseAlert variant="warning" class="mb-4">
              Attention : Le changement de nom d'utilisateur est définitif. Vous ne pourrez le modifier qu'une seule fois.
            </BaseAlert>

            <form @submit.prevent="handleUsernameChange" class="space-y-4">
              <BaseInput
                v-model="newUsername"
                label="Nouveau nom d'utilisateur"
                placeholder="Votre pseudo"
                :disabled="isSavingUsername"
              />
              <div class="flex justify-end">
                <BaseButton
                  type="submit"
                  :loading="isSavingUsername"
                  :disabled="!newUsername || newUsername === authStore.user?.username"
                  size="sm"
                >
                  Mettre à jour
                </BaseButton>
              </div>
            </form>
          </div>
        </div>

        <!-- Email change form -->
        <div class="pt-6 border-t border-surface-border dark:border-surface-dark-border space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <Mail class="w-4 h-4 text-text-muted dark:text-text-dark-muted" />
              <p class="font-medium text-text-main dark:text-text-dark-main">Adresse email</p>
            </div>
            <p class="text-sm text-text-muted dark:text-text-dark-muted mt-1 italic">
              Note : Votre email sert à la connexion. Ces informations ne font pas partie des données chiffrées par votre mot de passe (seules vos données financières le sont).
            </p>
          </div>

          <BaseAlert v-if="emailError" variant="danger">{{ emailError }}</BaseAlert>
          <BaseAlert v-if="emailSuccess" variant="success">{{ emailSuccess }}</BaseAlert>
          <BaseAlert v-if="isEmailLocked" variant="warning">{{ emailLockMessage }}</BaseAlert>

          <form @submit.prevent="handleEmailChange" class="space-y-4">
            <BaseInput
              v-model="newEmail"
              label="Nouvelle adresse email"
              type="email"
              placeholder="votre@email.com"
              :disabled="isEmailLocked || isSavingEmail"
            />
            <div class="flex justify-end">
              <BaseButton
                type="submit"
                :loading="isSavingEmail"
                :disabled="isEmailLocked || !newEmail || newEmail === authStore.user?.email"
                size="sm"
              >
                Mettre à jour
              </BaseButton>
            </div>
          </form>
        </div>
      </div>
    </BaseCard>

    <!-- ── Password change ─────────────────────────────── -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <KeyRound class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Mot de passe</h3>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Vos données restent lisibles après un changement de mot de passe. Toutes vos autres sessions seront déconnectées.
        </p>

        <BaseAlert v-if="passwordError" variant="danger">{{ passwordError }}</BaseAlert>
        <BaseAlert v-if="passwordSuccess" variant="success">{{ passwordSuccess }}</BaseAlert>

        <form @submit.prevent="handlePasswordChange" class="space-y-4">
          <BaseInput
            v-model="currentPassword"
            type="password"
            label="Mot de passe actuel"
            placeholder="••••••••"
            :disabled="isSavingPassword"
            required
          />
          <BaseInput
            v-model="newPassword"
            type="password"
            label="Nouveau mot de passe"
            placeholder="••••••••"
            :disabled="isSavingPassword"
            required
          />
          <BaseInput
            v-model="confirmPassword"
            type="password"
            label="Confirmer le nouveau mot de passe"
            placeholder="••••••••"
            :error="confirmPassword && !passwordsMatch ? 'Les mots de passe ne correspondent pas' : ''"
            :disabled="isSavingPassword"
            required
          />
          <BaseInput
            v-if="totpEnabled"
            v-model="passwordTotp"
            label="Code 2FA"
            placeholder="123456"
            inputmode="numeric"
            autocomplete="one-time-code"
            :disabled="isSavingPassword"
            required
          />
          <div class="flex justify-end">
            <BaseButton
              type="submit"
              :loading="isSavingPassword"
              :disabled="!canSubmitPassword"
              size="sm"
            >
              Modifier le mot de passe
            </BaseButton>
          </div>
        </form>
      </div>
    </BaseCard>

    <!-- ── Two-factor authentication ───────────────────── -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Double authentification (2FA)</h3>
        </div>
      </template>

      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <BaseBadge v-if="totpEnabled" variant="success">Activée</BaseBadge>
          <BaseBadge v-else variant="secondary">Désactivée</BaseBadge>
        </div>

        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Ajoutez une couche de sécurité supplémentaire avec une application d'authentification
          (Google Authenticator, Authy…). Un code sera demandé à chaque connexion.
        </p>

        <div v-if="!totpEnabled" class="flex justify-end">
          <BaseButton size="sm" @click="showSetupModal = true">Activer la 2FA</BaseButton>
        </div>

        <div v-else class="flex flex-wrap justify-end gap-3">
          <BaseButton variant="outline" size="sm" @click="regenModal.open = true">
            Régénérer les codes de secours
          </BaseButton>
          <BaseButton variant="danger" size="sm" @click="disableModal.open = true">
            Désactiver la 2FA
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- ── Recovery key ────────────────────────────────── -->
    <BaseCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-secondary bg-primary/10 flex items-center justify-center shrink-0">
            <LifeBuoy class="w-4 h-4 text-primary" stroke-width="2" />
          </div>
          <h3 class="text-lg font-semibold text-text-main dark:text-text-dark-main">Clé de récupération</h3>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-text-muted dark:text-text-dark-muted">
          Sans email de réinitialisation, la clé de récupération est votre seule porte de secours si vous
          oubliez votre mot de passe — elle préserve l'accès à vos données chiffrées. Générez-la et conservez-la hors ligne.
        </p>
        <BaseAlert variant="info">
          Générer une nouvelle clé invalide la précédente. La clé est affichée une seule fois.
        </BaseAlert>
        <div class="flex justify-end">
          <BaseButton variant="outline" size="sm" @click="recoveryModal.open = true">
            Générer une clé de récupération
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- ── Modals ──────────────────────────────────────── -->
    <TwoFactorSetupModal
      :open="showSetupModal"
      @close="showSetupModal = false"
      @enabled="on2faEnabled"
    />

    <PasswordCodeModal
      :open="disableModal.open"
      title="Désactiver la 2FA"
      description="Confirmez votre mot de passe et un code pour désactiver la double authentification."
      submit-label="Désactiver"
      danger
      :loading="disableModal.loading"
      :error="disableModal.error"
      @close="disableModal.open = false"
      @submit="handleDisable2fa"
    />

    <PasswordCodeModal
      :open="regenModal.open"
      title="Régénérer les codes de secours"
      description="Vos anciens codes de secours seront invalidés."
      submit-label="Régénérer"
      :loading="regenModal.loading"
      :error="regenModal.error"
      @close="regenModal.open = false"
      @submit="handleRegenBackupCodes"
    />

    <PasswordCodeModal
      :open="recoveryModal.open"
      title="Générer une clé de récupération"
      description="Confirmez votre mot de passe pour générer une nouvelle clé de récupération."
      submit-label="Générer"
      :require-code="false"
      :loading="recoveryModal.loading"
      :error="recoveryModal.error"
      @close="recoveryModal.open = false"
      @submit="handleGenerateRecoveryKey"
    />

    <SecretRevealModal
      :open="reveal.open"
      :title="reveal.title"
      :description="reveal.description"
      :secrets="reveal.secrets"
      :filename="reveal.filename"
      @close="reveal.open = false"
    />
  </div>
</template>
