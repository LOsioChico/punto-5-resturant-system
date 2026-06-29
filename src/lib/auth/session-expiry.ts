/**
 * Waiter session expiry logic — extracted from use-auth.tsx for testability.
 *
 * The shift ends at 6:00 AM Colombia time. A waiter who logged in before
 * the most recent 6am boundary has an expired session and must be signed out.
 */

import { lastLogoutTime } from "@/lib/timezone";

const WAITER_LOGIN_KEY = "waiter_login_time";

/** Store the waiter login timestamp (called only on SIGNED_IN event). */
export function setWaiterLoginTime(): void {
  try {
    localStorage.setItem(WAITER_LOGIN_KEY, Date.now().toString());
  } catch { /* localStorage may be unavailable (private mode) */ }
}

/** Clear the waiter login timestamp (called on sign-out). */
export function clearWaiterLoginTime(): void {
  try {
    localStorage.removeItem(WAITER_LOGIN_KEY);
  } catch { /* ignore */ }
}

/**
 * Get the stored waiter login time as a timestamp (ms since epoch),
 * or null if not stored.
 */
export function getWaiterLoginTime(): number | null {
  try {
    const loginTime = localStorage.getItem(WAITER_LOGIN_KEY);
    if (!loginTime) return null;
    return parseInt(loginTime, 10);
  } catch {
    return null;
  }
}

/**
 * Check if the stored waiter login time predates the most recent 6am
 * Colombia boundary. Returns false if no login time is stored (can't
 * determine — let the timer handle it).
 *
 * @param now - Current time (injectable for testing)
 */
export function isWaiterSessionExpired(now: Date = new Date()): boolean {
  const loginTime = getWaiterLoginTime();
  if (loginTime === null) return false;
  return loginTime < lastLogoutTime(now).getTime();
}
