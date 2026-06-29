/**
 * Timezone utilities for Colombia (America/Bogota, UTC-5).
 *
 * All date operations in the app should go through these helpers
 * to ensure consistent timezone handling regardless of the user's
 * device timezone.
 */

import { formatISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const COLOMBIA_TZ = "America/Bogota";

/** Auto-logout time for waiters: 6:00 AM Colombia time. */
export const WAITER_LOGOUT_HOUR = 6;

/**
 * Get the current instant as an ISO 8601 UTC string.
 * Use this instead of `new Date().toISOString()` everywhere —
 * `new Date()` should only appear in this file.
 */
export function nowISO(): string {
  return formatISO(new Date());
}

/**
 * Get the current time in Colombia timezone.
 * Use this instead of `new Date()` when you need to compare
 * against Colombia-local dates (e.g. "today" filter, 6am logout).
 */
export function nowInColombia(): Date {
  return toZonedTime(new Date(), COLOMBIA_TZ);
}

/**
 * Get the start of "today" in Colombia timezone as a UTC Date.
 * Useful for date filtering — compares against created_at timestamps
 * which are stored in UTC.
 */
export function startOfTodayColombia(now: Date = new Date()): Date {
  const zoned = toZonedTime(now, COLOMBIA_TZ);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  // Build midnight Colombia time, then convert back to UTC
  return fromZonedTime(new Date(year, month, day), COLOMBIA_TZ);
}

/**
 * Get the start of "yesterday" in Colombia timezone as a UTC Date.
 */
export function startOfYesterdayColombia(now: Date = new Date()): Date {
  const today = startOfTodayColombia(now);
  return new Date(today.getTime() - 86_400_000);
}

/**
 * Check if a timestamp falls on a given Colombia-local date (today/yesterday).
 * `targetStart` should be the start-of-day UTC from startOfTodayColombia or startOfYesterdayColombia.
 */
export function isOnColombiaDate(
  timestamp: string | Date,
  targetStart: Date,
): boolean {
  const created = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const nextDay = new Date(targetStart.getTime() + 86_400_000);
  return created >= targetStart && created < nextDay;
}

/**
 * Get the next 6am Colombia time as a UTC Date.
 * Used to set a timer for auto-logout.
 * If it's currently before 6am, returns today's 6am.
 * If it's currently 6am or later, returns tomorrow's 6am.
 */
export function nextLogoutTime(now: Date = new Date()): Date {
  const zoned = toZonedTime(now, COLOMBIA_TZ);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  const logout6am = fromZonedTime(
    new Date(year, month, day, WAITER_LOGOUT_HOUR, 0, 0, 0),
    COLOMBIA_TZ,
  );
  // If we haven't hit 6am yet today, return today's 6am
  if (zoned.getHours() < WAITER_LOGOUT_HOUR) {
    return logout6am;
  }
  // Otherwise return tomorrow's 6am
  return new Date(logout6am.getTime() + 86_400_000);
}

/**
 * Format a timestamp for display in Colombia timezone.
 * Defaults to a short time format (HH:mm).
 */
export function formatInColombia(
  date: Date | string,
  fmt: string = "HH:mm",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, COLOMBIA_TZ, fmt, { locale: es });
}
