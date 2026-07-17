import { describe, expect, it } from 'vitest'
import {
  datetimeLocalToIso,
  ensureUtc,
  isDateOnly,
  isoToDatetimeLocal,
  nowDatetimeLocal,
  toDatetimeLocalValue,
} from '../datetime'
import { utcOffsetLabel } from '@/composables/useDisplayTimezone'

// Note: tests must not depend on the machine's timezone. Local-time behavior
// is checked through round-trip invariants and locally-constructed Dates.

describe('toDatetimeLocalValue', () => {
  it('formats a local Date as YYYY-MM-DDTHH:mm', () => {
    expect(toDatetimeLocalValue(new Date(2026, 5, 15, 14, 30))).toBe('2026-06-15T14:30')
  })

  it('zero-pads all components', () => {
    expect(toDatetimeLocalValue(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07')
  })
})

describe('nowDatetimeLocal', () => {
  it('matches the datetime-local input format', () => {
    expect(nowDatetimeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('ensureUtc', () => {
  it('appends Z to a naive datetime (legacy API values are UTC)', () => {
    expect(ensureUtc('2026-06-15T12:00:00')).toBe('2026-06-15T12:00:00Z')
  })

  it('leaves an explicit Z untouched', () => {
    expect(ensureUtc('2026-06-15T12:00:00Z')).toBe('2026-06-15T12:00:00Z')
  })

  it('leaves an explicit offset untouched', () => {
    expect(ensureUtc('2026-06-15T12:00:00+02:00')).toBe('2026-06-15T12:00:00+02:00')
  })

  it('leaves date-only strings untouched (already parsed as UTC midnight)', () => {
    expect(ensureUtc('2026-06-15')).toBe('2026-06-15')
  })
})

describe('isDateOnly', () => {
  it('detects civil dates vs datetimes', () => {
    expect(isDateOnly('2026-06-15')).toBe(true)
    expect(isDateOnly('2026-06-15T12:00:00Z')).toBe(false)
  })
})

describe('local ↔ UTC round-trips', () => {
  it('datetimeLocalToIso then isoToDatetimeLocal restores the input', () => {
    const input = '2026-06-15T14:30'
    expect(isoToDatetimeLocal(datetimeLocalToIso(input))).toBe(input)
  })

  it('datetimeLocalToIso produces a UTC instant equal to the local wall-clock time', () => {
    const iso = datetimeLocalToIso('2026-06-15T14:30')
    expect(iso.endsWith('Z')).toBe(true)
    expect(new Date(iso).getTime()).toBe(new Date(2026, 5, 15, 14, 30).getTime())
  })

  it('isoToDatetimeLocal accepts legacy values without Z as UTC', () => {
    // Whatever the machine timezone, both spellings must land on the same local value.
    expect(isoToDatetimeLocal('2026-06-15T12:00:00')).toBe(isoToDatetimeLocal('2026-06-15T12:00:00Z'))
  })
})

describe('utcOffsetLabel', () => {
  it('formats UTC as +00:00', () => {
    expect(utcOffsetLabel('UTC')).toBe('UTC+00:00')
  })

  it('reflects DST for Europe/Paris at a fixed date', () => {
    expect(utcOffsetLabel('Europe/Paris', new Date('2026-01-15T12:00:00Z'))).toBe('UTC+01:00')
    expect(utcOffsetLabel('Europe/Paris', new Date('2026-07-15T12:00:00Z'))).toBe('UTC+02:00')
  })

  it('handles half-hour offsets', () => {
    expect(utcOffsetLabel('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'))).toBe('UTC+05:30')
  })

  it('returns empty string for an unknown timezone', () => {
    expect(utcOffsetLabel('Mars/Olympus_Mons')).toBe('')
  })
})
