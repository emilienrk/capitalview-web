/**
 * Helpers for <input type="datetime-local"> ↔ API (UTC) conversion.
 *
 * Convention: the API works exclusively in UTC (ISO 8601 with "Z").
 * datetime-local inputs hold the user's local wall-clock time, so values
 * must be converted in both directions.
 */

/** Format a Date as a datetime-local input value (local time, YYYY-MM-DDTHH:mm). */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Current local time as a datetime-local input value. */
export function nowDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date())
}

/** API datetimes predating the "Z" convention lack a timezone marker; they are UTC. */
export function ensureUtc(iso: string): string {
  if (!iso.includes('T')) return iso // date-only string: JS already parses it as UTC midnight
  return /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`
}

/** True for civil date strings (YYYY-MM-DD) that carry no time component. */
export function isDateOnly(value: string): boolean {
  return !value.includes('T')
}

/** Convert an API UTC ISO string to a datetime-local input value (local time). */
export function isoToDatetimeLocal(iso: string): string {
  return toDatetimeLocalValue(new Date(ensureUtc(iso)))
}

/** Convert a datetime-local input value (local time) to a UTC ISO string for the API. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}
