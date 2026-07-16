import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient, setSessionExpiredHandler } from '@/api/client'
import { resetAllSessionState } from '@/services/sessionReset'
import type {
  User,
  TokenResponse,
  LoginRequest,
  RegisterRequest,
  TwoFARequiredResponse,
  LoginOutcome,
  PasswordChangeRequest,
  RecoveryKeyResponse,
  RecoverRequest,
  RecoverResponse,
  TwoFASetupResponse,
  TwoFAEnableResponse,
} from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const isInitialized = ref(false)

  const loginForm = ref({ email: '', password: '' })
  const registerForm = ref({ username: '', email: '', password: '' })
  const isRegisterMode = ref(false)


  function setToken(token: string | null) {
    accessToken.value = token
    apiClient.setToken(token)
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
    isAuthenticated.value = false
    apiClient.setToken(null)
    // Wipe caches and data stores so nothing from this session leaks into
    // the next one (logout or session expiry, same tab, no reload).
    void resetAllSessionState()
  }

  function _registerSessionExpiredHandler() {
    setSessionExpiredHandler(() => {
      clearSession()
      import('@/router/index').then(({ default: router }) => {
        if (router.currentRoute.value.meta.requiresAuth) {
          router.push({ name: 'login' })
        }
      })
    })
  }

  function resetForms() {
    loginForm.value = { email: '', password: '' }
    registerForm.value = { username: '', email: '', password: '' }
    error.value = null
  }

  /** Finalize a session once a full TokenResponse is available (login or 2FA step 2). */
  async function _finishSession(response: TokenResponse): Promise<void> {
    // Start from a clean slate: a previous session (another user, or stale
    // data from before a session expiry) must not survive into this one.
    await resetAllSessionState()
    setToken(response.access_token)
    user.value = await apiClient.get<User>('/auth/me')
    resetForms()
    isAuthenticated.value = true
  }

  async function login(credentials?: LoginRequest): Promise<LoginOutcome> {
    isLoading.value = true
    error.value = null

    const creds = credentials || {
      email: loginForm.value.email,
      password: loginForm.value.password,
    }

    try {
      const response = await apiClient.post<TokenResponse | TwoFARequiredResponse>('/auth/login', creds)
      // 2FA enabled: no session yet, complete via completeLogin2fa()
      if ('two_fa_required' in response && response.two_fa_required) {
        return { status: '2fa', pendingToken: response.pending_token, expiresIn: response.expires_in }
      }
      await _finishSession(response as TokenResponse)
      return { status: 'success' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed'
      error.value = message
      return { status: 'error', message }
    } finally {
      isLoading.value = false
    }
  }

  /** Login step 2: exchange the pending token + TOTP/backup code for a session. */
  async function completeLogin2fa(pendingToken: string, code: string): Promise<LoginOutcome> {
    isLoading.value = true
    error.value = null
    try {
      const response = await apiClient.post<TokenResponse>('/auth/login/2fa', {
        pending_token: pendingToken,
        code,
      })
      await _finishSession(response)
      return { status: 'success' }
    } catch (e) {
      const message = e instanceof Error ? e.message : '2FA verification failed'
      error.value = message
      return { status: 'error', message }
    } finally {
      isLoading.value = false
    }
  }

  async function register(data?: RegisterRequest): Promise<boolean> {
    isLoading.value = true
    error.value = null

    const registerData = data || {
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: registerForm.value.password,
    }

    try {
      const response = await apiClient.post<TokenResponse>('/auth/register', registerData)
      await resetAllSessionState()
      setToken(response.access_token)
      isAuthenticated.value = true
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Registration failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function submitForm(router: ReturnType<typeof useRouter>): Promise<void> {
    if (isRegisterMode.value) {
      const success = await register()
      if (success) {
        await login({
          email: registerForm.value.email,
          password: registerForm.value.password,
        })
        router.push('/')
      }
    } else {
      const outcome = await login()
      if (outcome.status === 'success') {
        router.push('/')
      }
    }
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const response = await apiClient.post<TokenResponse>('/auth/refresh')
      setToken(response.access_token)
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function checkAuth(): Promise<void> {
    if (isInitialized.value) return

    // Register the session-expired callback so the client can invalidate the
    // session without reloading the page if a refresh token ever becomes invalid
    // while the user is browsing.
    _registerSessionExpiredHandler()

    try {
      const response = await apiClient.post<TokenResponse>('/auth/refresh')
      setToken(response.access_token)

      isAuthenticated.value = true

      // Loaded off the critical path so the app paints immediately;
      // failures are logged instead of silently swallowed.
      apiClient.get<User>('/auth/me').then((u) => {
        user.value = u
      }).catch((e) => {
        console.error('Impossible de charger le profil utilisateur :', e)
      })
    } catch {
      clearSession()
      isAuthenticated.value = false
    } finally {
      isInitialized.value = true
    }
  }

  async function updateProfile(data: { username?: string, email?: string }): Promise<void> {
    if (!user.value) return
    
    if (data.username && data.username !== user.value.username) {
      user.value = await apiClient.put<User>('/auth/me/username', { username: data.username })
    }
    
    if (data.email && data.email !== user.value.email) {
      user.value = await apiClient.put<User>('/auth/me/email', { email: data.email })
    }
  }

  /**
   * Change the account password. The Master Key is only re-wrapped server-side,
   * so encrypted data stays readable. All sessions are revoked and a fresh one
   * is returned in the cookies — we swap in the new access token in place.
   */
  async function changePassword(payload: PasswordChangeRequest): Promise<void> {
    const response = await apiClient.put<TokenResponse>('/auth/me/password', payload)
    setToken(response.access_token)
  }

  /** Generate (or regenerate) the recovery key. Returned once — never stored. */
  async function generateRecoveryKey(password: string): Promise<string> {
    const response = await apiClient.post<RecoveryKeyResponse>('/auth/recovery-key', { password })
    return response.recovery_key
  }

  /**
   * Reset the password using the recovery key (no login required). Logs the user
   * in and returns the single-use replacement recovery key (shown once).
   */
  async function recover(payload: RecoverRequest): Promise<string> {
    const response = await apiClient.post<RecoverResponse>('/auth/recover', payload)
    await _finishSession(response)
    return response.new_recovery_key
  }

  // ── Two-factor authentication (TOTP) ──────────────────────────

  /** Start 2FA setup: returns the secret + otpauth:// URI to render as a QR. */
  async function setup2fa(password: string): Promise<TwoFASetupResponse> {
    return apiClient.post<TwoFASetupResponse>('/auth/2fa/setup', { password })
  }

  /** Confirm 2FA with a first valid code. Returns the single-use backup codes. */
  async function enable2fa(code: string): Promise<string[]> {
    const response = await apiClient.post<TwoFAEnableResponse>('/auth/2fa/enable', { code })
    if (user.value) user.value.totp_enabled = true
    return response.backup_codes
  }

  /** Disable 2FA (password + TOTP/backup code required). */
  async function disable2fa(password: string, code: string): Promise<void> {
    await apiClient.post('/auth/2fa/disable', { password, code })
    if (user.value) user.value.totp_enabled = false
  }

  /** Regenerate the 10 backup codes (invalidates the previous ones). */
  async function regenerateBackupCodes(password: string, code: string): Promise<string[]> {
    const response = await apiClient.post<TwoFAEnableResponse>('/auth/2fa/backup-codes', { password, code })
    return response.backup_codes
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } catch (e) {
      console.error('Logout error:', e)
    } finally {
      clearSession()
    }
  }

  return {
    user,
    accessToken,
    isLoading,
    error,
    isAuthenticated,
    loginForm,
    registerForm,
    isRegisterMode,
    isInitialized,
    resetForms,
    login,
    completeLogin2fa,
    register,
    submitForm,
    refreshToken,
    checkAuth,
    updateProfile,
    changePassword,
    generateRecoveryKey,
    recover,
    setup2fa,
    enable2fa,
    disable2fa,
    regenerateBackupCodes,
    logout
  }
})
