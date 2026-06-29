import { describe, it, expect } from "vitest";
import { nextLogoutTime, lastLogoutTime, COLOMBIA_TZ } from "./timezone";
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

    it("returns tomorrow's 6am when exactly at 6am", () => {
      const sixAm = atColombiaTime(6, 0);
      const result = nextLogoutTime(sixAm);
      const expected = atColombiaTime(6, 0, 1);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe("lastLogoutTime", () => {
    it("returns yesterday's 6am when before 6am", () => {
      const threeAm = atColombiaTime(3, 0);
      const result = lastLogoutTime(threeAm);
      const expected = atColombiaTime(6, 0, -1);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it("returns today's 6am when after 6am", () => {
      const threePm = atColombiaTime(15, 0);
      const result = lastLogoutTime(threePm);
      const expected = atColombiaTime(6, 0);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it("returns today's 6am when exactly at 6am", () => {
      const sixAm = atColombiaTime(6, 0);
      const result = lastLogoutTime(sixAm);
      const expected = atColombiaTime(6, 0);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });
});
