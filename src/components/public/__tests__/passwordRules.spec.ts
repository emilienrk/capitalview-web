import { describe, expect, it } from 'vitest'
import { passwordAccepted } from '../passwordRules'

describe('passwordAccepted', () => {
  it('takes a 16+ character passphrase without the mix rules', () => {
    expect(passwordAccepted('cheval agrafe batterie correct')).toBe(true)
  })

  it('asks a shorter password to mix every kind of character', () => {
    expect(passwordAccepted('chevalagrafe')).toBe(false)
    expect(passwordAccepted('Cheval-agr4fe')).toBe(true)
  })
})
