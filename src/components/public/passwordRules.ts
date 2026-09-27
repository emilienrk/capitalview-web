// Mirrors validate_password_strength in the API (register, password change, recovery).
export function passwordRules(password: string) {
  return [
    { label: 'Au moins 8 caractères', met: password.length >= 8 },
    { label: 'Une majuscule', met: /[A-Z]/.test(password) },
    { label: 'Une minuscule', met: /[a-z]/.test(password) },
    { label: 'Un chiffre', met: /\d/.test(password) },
    { label: 'Un caractère spécial', met: /[^A-Za-z0-9]/.test(password) },
  ]
}
