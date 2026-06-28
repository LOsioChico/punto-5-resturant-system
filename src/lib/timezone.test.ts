import { describe, it, expect } from "vitest";
import { isPastLogoutTime, nextLogoutTime, COLOMBIA_TZ, WAITER_LOGOUT_HOUR } from "./timezone";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

describe("6am logout logic", () => {
  // Helper: create a Date at a specific Colombia-local time
  function atColombiaTime(hour: number, minute: number = 0, dayOffset: number = 0): Date {
    const now = toZonedTime(new Date(), COLOMBIA_TZ);
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate() + dayOffset;
    return fromZonedTime(new Date(year, month, day, hour, minute, 0, 0), COLOMBIA_TZ);
  }

  describe("isPastLogoutTime", () => {
    it("returns false before 6am", () => {
      const threeAm = atColombiaTime(3, 0);
      expect(isPastLogoutTime(threeAm)).toBe(false);
    });

    it("returns true at 6am", () => {
      const sixAm = atColombiaTime(6, 0);
      expect(isPastLogoutTime(sixAm)).toBe(true);
    });

    it("returns true after 6am", () => {
      const sevenPm = atColombiaTime(19, 0);
      expect(isPastLogoutTime(sevenPm)).toBe(true);
    });
  });

  describe("nextLogoutTime", () => {
    it("returns today's 6am when before 6am", () => {
      const threeAm = atColombiaTime(3, 0);
      const result = nextLogoutTime(threeAm);
      const expected = atColombiaTime(6, 0);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it("returns tomorrow's 6am when after 6am", () => {
      const sevenPm = atColombiaTime(19, 0);
      const result = nextLogoutTime(sevenPm);
      const expected = atColombiaTime(6, 0, 1);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe("6am logout scenario — session age check", () => {
    // The logic in use-auth.tsx:
    //   const last6am = new Date(nextLogoutTime(now).getTime() - 86_400_000);
    //   if (sessionCreated < last6am) → log out
    //
    // This tests that logic directly.

    function shouldLogOut(sessionCreatedAt: Date, now: Date): boolean {
      const last6am = new Date(nextLogoutTime(now).getTime() - 86_400_000);
      return sessionCreatedAt < last6am;
    }

    it("does NOT log out a fresh login after 6am (new shift)", () => {
      const now = atColombiaTime(19, 0); // 7pm
      const sessionCreated = atColombiaTime(19, 0); // just logged in at 7pm
      expect(shouldLogOut(sessionCreated, now)).toBe(false);
    });

    it("does NOT log out a fresh login before 6am", () => {
      const now = atColombiaTime(3, 0); // 3am
      const sessionCreated = atColombiaTime(3, 0); // just logged in at 3am
      expect(shouldLogOut(sessionCreated, now)).toBe(false);
    });

    it("DOES log out a stale session from before 6am (refreshed after 6am)", () => {
      const now = atColombiaTime(7, 0); // 7am
      const sessionCreated = atColombiaTime(2, 0); // logged in at 2am
      expect(shouldLogOut(sessionCreated, now)).toBe(true);
    });

    it("DOES log out a session from yesterday evening (refreshed after 6am today)", () => {
      const now = atColombiaTime(7, 0); // 7am today
      const sessionCreated = atColombiaTime(20, 0, -1); // logged in at 8pm yesterday
      expect(shouldLogOut(sessionCreated, now)).toBe(true);
    });

    it("does NOT log out a session from yesterday evening (refreshed before 6am today)", () => {
      const now = atColombiaTime(3, 0); // 3am today
      const sessionCreated = atColombiaTime(20, 0, -1); // logged in at 8pm yesterday
      expect(shouldLogOut(sessionCreated, now)).toBe(false);
    });
  });
});
