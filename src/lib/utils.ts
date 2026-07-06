import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays, differenceInMonths, differenceInYears } from "date-fns";
import type { Order, OrderItem } from "./types";
import { formatInColombia } from "./timezone";

/** Merge Tailwind classes with conditional support. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check whether a waiter is the owner of an order.
 * Used to enforce that waiters can only modify orders they created.
 * In production this should also be enforced via RLS with auth.
 */
export function isOrderOwner(order: Order, waiterName: string): boolean {
  return order.waiter_name === waiterName;
}

/** Format a number as Colombian peso currency in Spanish. */
export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

/** Format a timestamp as a short Spanish time string in Colombia timezone. */
export function formatTime(date: Date | string): string {
  return formatInColombia(date, "HH:mm");
}

/** Human-readable elapsed time since a timestamp, in Spanish. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = differenceInSeconds(new Date(), d);
  if (seconds < 60) return "hace un momento";
  const minutes = differenceInMinutes(new Date(), d);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = differenceInHours(new Date(), d);
  if (hours < 24) return `hace ${hours}h ${minutes % 60}min`;
  const days = differenceInDays(new Date(), d);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  const months = differenceInMonths(new Date(), d);
  if (months < 12) return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
  const years = differenceInYears(new Date(), d);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}

/**
 * Table 18 is reserved for delivery / to-go orders.
 * Tables 1-17 are regular dining tables.
 */
export const DELIVERY_TABLE = 18;
export const TABLE_COUNT = 17;

/** Desechables (disposables) fee charged per dish (in COP) for Domicilio orders. */
export const DESECHABLES_PER_DISH = 1000;

/** Check if a table number is the delivery/to-go table. */
export function isDeliveryTable(table: number): boolean {
  return table === DELIVERY_TABLE;
}

/**
 * Get the display label for a table.
 * Tables 1-17: "Mesa N"
 * Table 18: "Domicilio"
 */
export function tableLabel(table: number): string {
  return isDeliveryTable(table) ? "Domicilio" : `Mesa ${table}`;
}

/**
 * Get just the short name for a table (without "Mesa" prefix).
 * Tables 1-17: the number as string
 * Table 18: "Domicilio"
 */
export function tableShortName(table: number): string {
  return isDeliveryTable(table) ? "Domicilio" : String(table);
}

/**
 * Split an order item into individual units when any unit has a note.
 * If no notes, returns null (caller should render grouped).
 * If any unit has a note, returns an array of per-unit objects.
 */
export function splitPerUnit(item: OrderItem): { note: string }[] | null {
  const notes = item.notes ?? [];
  if (!notes.some((n) => n.trim())) return null;
  return Array.from({ length: item.quantity }, (_, i) => ({
    note: notes[i]?.trim() ?? "",
  }));
}
