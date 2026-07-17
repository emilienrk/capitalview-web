import { computed, ref, type ComputedRef, type Ref } from 'vue'

const STORAGE_KEY = 'capitalview:display-timezone'

/**
 * User-chosen display timezone for all date/time formatting.
 * Empty string means "browser default". The backend always works in UTC;
 * this preference only affects presentation.
 *
 * The server-side user settings are the source of truth (synced by the
 * settings store via applyServerTimezone). localStorage is only a boot
 * cache so the first render uses the right timezone before /settings loads.
 */
const storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage

const displayTimezone = ref<string>(storage?.getItem(STORAGE_KEY) ?? '')

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

function persistLocally(tz: string): void {
  if (tz) storage?.setItem(STORAGE_KEY, tz)
  else storage?.removeItem(STORAGE_KEY)
}

/** Current UTC offset of a timezone, formatted as "UTC+02:00". */
export function utcOffsetLabel(tz: string, at: Date = new Date()): string {
  try {
    const options = { timeZone: tz, timeZoneName: 'longOffset' } as Intl.DateTimeFormatOptions
    const name = new Intl.DateTimeFormat('en', options)
      .formatToParts(at)
      .find(part => part.type === 'timeZoneName')?.value ?? ''
    const match = name.match(/GMT([+-]\d{2}:\d{2})?/)
    if (!match) return ''
    return `UTC${match[1] ?? '+00:00'}`
  } catch {
    return ''
  }
}

export function useDisplayTimezone(): {
  displayTimezone: Ref<string>
  effectiveTimezone: ComputedRef<string>
  effectiveTimezoneLabel: ComputedRef<string>
  setDisplayTimezone: (tz: string) => void
  applyServerTimezone: (tz: string | null | undefined) => void
  browserTimezone: string
} {
  /** The timezone actually used for rendering (preference or browser). */
  const effectiveTimezone = computed(() => displayTimezone.value || browserTimezone)

  /** Human label, e.g. "Europe/Paris (UTC+02:00)". */
  const effectiveTimezoneLabel = computed(() => {
    const tz = effectiveTimezone.value
    const offset = utcOffsetLabel(tz)
    return offset ? `${tz.split('_').join(' ')} (${offset})` : tz
  })

  /** Set the preference locally (the caller is responsible for saving it server-side). */
  function setDisplayTimezone(tz: string): void {
    displayTimezone.value = tz
    persistLocally(tz)
  }

  /** Align the local preference with the server value (server wins). */
  function applyServerTimezone(tz: string | null | undefined): void {
    const value = tz ?? ''
    if (value !== displayTimezone.value) displayTimezone.value = value
    persistLocally(value)
  }

  return {
    displayTimezone,
    effectiveTimezone,
    effectiveTimezoneLabel,
    setDisplayTimezone,
    applyServerTimezone,
    browserTimezone,
  }
}
