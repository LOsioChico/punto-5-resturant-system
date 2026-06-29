import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  setWaiterLoginTime,
  clearWaiterLoginTime,
  getWaiterLoginTime,
  isWaiterSessionExpired,
} from "./session-expiry";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { COLOMBIA_TZ } from "@/lib/timezone";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

// Helper: create a Date at a specific Colombia-local time
function atColombiaTime(hour: number, minute: number = 0, dayOffset: number = 0): Date {
  const now = toZonedTime(new Date(), COLOMBIA_TZ);
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate() + dayOffset;
  return fromZonedTime(new Date(year, month, day, hour, minute, 0, 0), COLOMBIA_TZ);
}

describe("session-expiry", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("setWaiterLoginTime / getWaiterLoginTime", () => {
    it("stores and retrieves the login time", () => {
      const before = Date.now();
      setWaiterLoginTime();
      const after = Date.now();
      const stored = getWaiterLoginTime();
      expect(stored).not.toBeNull();
      expect(stored!).toBeGreaterThanOrEqual(before);
      expect(stored!).toBeLessThanOrEqual(after);
    });
  });

  describe("clearWaiterLoginTime", () => {
    it("removes the stored login time", () => {
      setWaiterLoginTime();
      expect(getWaiterLoginTime()).not.toBeNull();
      clearWaiterLoginTime();
      expect(getWaiterLoginTime()).toBeNull();
    });
  });

  describe("isWaiterSessionExpired", () => {
    it("returns false when no login time is stored", () => {
      expect(isWaiterSessionExpired(new Date())).toBe(false);
    });

    it("returns false when login is after the most recent 6am (same day)", () => {
      // Login at 7am, check at 10am same day
      const loginTime = atColombiaTime(7, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(10, 0);
      expect(isWaiterSessionExpired(checkTime)).toBe(false);
    });

    it("returns false when login is after 6am and checking next day before 6am", () => {
      // Login at 7pm Monday, check at 3am Tuesday
      const loginTime = atColombiaTime(19, 0, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(3, 0, 1);
      expect(isWaiterSessionExpired(checkTime)).toBe(false);
    });

    it("returns true when login is before 6am and checking after 6am same day", () => {
      // Login at 3am, check at 7am same day — session expired at 6am
      const loginTime = atColombiaTime(3, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(7, 0);
      expect(isWaiterSessionExpired(checkTime)).toBe(true);
    });

    it("returns true when login is before 6am and checking at 6am exactly", () => {
      // Login at 5:30am, check at 6:00am — session expired
      const loginTime = atColombiaTime(5, 30).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(6, 0);
      expect(isWaiterSessionExpired(checkTime)).toBe(true);
    });

    it("returns true when login was yesterday and checking after today's 6am", () => {
      // Login at 7am Monday, check at 7am Tuesday — expired at Tuesday 6am
      const loginTime = atColombiaTime(7, 0, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(7, 0, 1);
      expect(isWaiterSessionExpired(checkTime)).toBe(true);
    });

    it("returns false when login is at exactly 6am", () => {
      // Login at 6:00am, check at 6:01am — not expired (login is at/after boundary)
      const loginTime = atColombiaTime(6, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(6, 1);
      expect(isWaiterSessionExpired(checkTime)).toBe(false);
    });

    it("returns false when login is at 6am and checking next day before 6am", () => {
      // Login at 6am Monday, check at 3am Tuesday — not expired
      const loginTime = atColombiaTime(6, 0, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(3, 0, 1);
      expect(isWaiterSessionExpired(checkTime)).toBe(false);
    });

    it("returns true when login is at 6am Monday and checking at 6am Tuesday", () => {
      // Login at 6am Monday, check at 6am Tuesday — expired
      const loginTime = atColombiaTime(6, 0, 0).getTime();
      store["waiter_login_time"] = loginTime.toString();
      const checkTime = atColombiaTime(6, 0, 1);
      expect(isWaiterSessionExpired(checkTime)).toBe(true);
    });
  });
});
