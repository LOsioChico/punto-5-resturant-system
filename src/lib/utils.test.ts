import { describe, it, expect } from "vitest";
import { cn, formatCOP, formatTime, timeAgo, isOrderOwner } from "./utils";
import type { Order } from "./types";

// ============================================================
// cn (class merge)
// ============================================================
describe("cn", () => {
  it("merges simple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", true && "active", false && "inactive")).toBe("base active");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });
});

// ============================================================
// formatCOP
// ============================================================
describe("formatCOP", () => {
  it("formats zero", () => {
    expect(formatCOP(0)).toMatch(/\$/);
    expect(formatCOP(0)).not.toContain("NaN");
  });

  it("formats thousands", () => {
    const result = formatCOP(5000);
    expect(result).toContain("5");
    expect(result).toContain("000");
    expect(result).toContain("$");
  });

  it("formats large numbers", () => {
    const result = formatCOP(150000);
    expect(result).toContain("150");
    expect(result).toContain("000");
  });

  it("has no decimal places (only thousands separators)", () => {
    const result = formatCOP(1234);
    // es-CO uses "." as thousands separator, no decimal places
    expect(result).not.toContain(",");
    expect(result).not.toMatch(/\.\d{2}$/); // No decimal cents
  });

  it("handles negative numbers", () => {
    const result = formatCOP(-5000);
    expect(result).toContain("5");
    // Negative should have a minus sign
    expect(result).toContain("-");
  });
});

// ============================================================
// formatTime
// ============================================================
describe("formatTime", () => {
  it("formats a Date object", () => {
    const date = new Date(2024, 0, 1, 14, 30);
    const result = formatTime(date);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats an ISO string", () => {
    const result = formatTime("2024-01-01T14:30:00Z");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats midnight", () => {
    const date = new Date(2024, 0, 1, 0, 0);
    const result = formatTime(date);
    // Could be "00:00" or "12:00 AM" depending on locale
    expect(result).toMatch(/\d{1,2}:00/);
  });

  it("formats 23:59", () => {
    const date = new Date(2024, 0, 1, 23, 59);
    const result = formatTime(date);
    expect(result).toMatch(/\d{1,2}:59/);
  });
});

// ============================================================
// timeAgo
// ============================================================
describe("timeAgo", () => {
  it("returns 'hace un momento' for less than 60 seconds", () => {
    const now = new Date();
    expect(timeAgo(now)).toBe("hace un momento");
  });

  it("returns 'hace un momento' for 30 seconds ago", () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(timeAgo(date)).toBe("hace un momento");
  });

  it("returns 'hace X min' for minutes", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(date)).toBe("hace 5 min");
  });

  it("returns 'hace 1 min' for exactly 1 minute", () => {
    const date = new Date(Date.now() - 60 * 1000);
    expect(timeAgo(date)).toBe("hace 1 min");
  });

  it("returns 'hace Xh Ymin' for hours", () => {
    const date = new Date(Date.now() - 125 * 60 * 1000); // 2h 5min
    expect(timeAgo(date)).toBe("hace 2h 5min");
  });

  it("handles ISO string input", () => {
    const date = new Date(Date.now() - 10 * 60 * 1000);
    expect(timeAgo(date.toISOString())).toBe("hace 10 min");
  });

  it("handles exactly 60 minutes", () => {
    const date = new Date(Date.now() - 60 * 60 * 1000);
    expect(timeAgo(date)).toBe("hace 1h 0min");
  });

  it("handles future dates (negative seconds)", () => {
    const date = new Date(Date.now() + 30 * 1000);
    // Negative seconds → < 60 → "hace un momento"
    expect(timeAgo(date)).toBe("hace un momento");
  });
});

// ============================================================
// isOrderOwner
// ============================================================
describe("isOrderOwner", () => {
  const baseOrder: Order = {
    id: "1",
    table_number: 5,
    waiter_name: "Juan",
    waiter_id: "waiter-1",
    status: "nueva",
    total: 25000,
    notes: null,
    delivery_name: null,
    delivery_fee: 0,
    created_at: new Date().toISOString(),
    items: [],
    updated_by: null,
    updated_at: null,
    updated_by_type: null,
  };

  it("returns true when waiter name matches", () => {
    expect(isOrderOwner(baseOrder, "Juan")).toBe(true);
  });

  it("returns false when waiter name does not match", () => {
    expect(isOrderOwner(baseOrder, "Pedro")).toBe(false);
  });

  it("returns false for empty waiter name", () => {
    expect(isOrderOwner(baseOrder, "")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isOrderOwner(baseOrder, "juan")).toBe(false);
    expect(isOrderOwner(baseOrder, "JUAN")).toBe(false);
  });

  it("handles whitespace in name", () => {
    expect(isOrderOwner(baseOrder, "Juan ")).toBe(false);
    expect(isOrderOwner(baseOrder, " Juan")).toBe(false);
  });
});
