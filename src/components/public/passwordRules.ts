// Mirrors validate_password_strength in the API (register, password change, recovery):
// a long passphrase passes as is, a shorter password must mix every kind of character.
export const PASSPHRASE_MIN_LENGTH = 16

export function passwordRules(password: string) {
  return [
    { label: 'Au moins 8 caractères', met: password.length >= 8 },
    { label: 'Une majuscule', met: /[A-Z]/.test(password) },
    { label: 'Une minuscule', met: /[a-z]/.test(password) },
    { label: 'Un chiffre', met: /\d/.test(password) },
    { label: 'Un caractère spécial', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function isPassphrase(password: string): boolean {
  return password.length >= PASSPHRASE_MIN_LENGTH
}

export function passwordAccepted(password: string): boolean {
  return isPassphrase(password) || passwordRules(password).every(rule => rule.met)
}
