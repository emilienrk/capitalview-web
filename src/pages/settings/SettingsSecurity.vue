<script setup lang="ts">
import { Lock, User as UserIcon, Mail } from 'lucide-vue-next'
import { ref, onMounted, computed } from 'vue'
import { BaseCard, BaseButton, BaseInput, BaseAlert } from '@/components'
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
    usernameError.value = error.response?.data?.detail || error.message || "Erreur lors de la mise à jour."
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
    emailError.value = error.response?.data?.detail || error.message || "Erreur lors de la mise à jour."
  } finally {
    isSavingEmail.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
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
  </div>
</template>
