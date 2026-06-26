import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order } from "./types";

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

/** Format a timestamp as a short Spanish time string. */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Human-readable elapsed time since a timestamp, in Spanish. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h ${minutes % 60}min`;
}
