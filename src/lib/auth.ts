/**
 * Authentication library.
 *
 * Two auth flows:
 *   - Admin: standard email/password via Supabase Auth
 *   - Waiter: cédula + 4-digit PIN via Supabase Auth (synthetic email)
 *
 * Waiter PIN is padded to 6 chars (Supabase Auth minimum) with a "p5" prefix.
 * The UI shows only 4 digits; the padding is invisible.
 */

import { createSupabaseClient } from "@/lib/supabase/client";
import type { Waiter, AuthRole } from "@/lib/types";

/** Prefix + minimum padding for waiter PINs (Supabase requires 6-char min). */
const PIN_PREFIX = "p5";

/** Pad a 4-digit PIN to meet Supabase Auth's 6-char password minimum. */
export function padPin(pin: string): string {
  return PIN_PREFIX + pin;
}

/** Synthetic email for waiter auth accounts. */
export function waiterEmail(cedula: string): string {
  return `${cedula}@punto5.co`;
}

/** Initial PIN for new waiters — must be changed on first login. */
export const INITIAL_PIN = "0000";

/**
 * Sign in as admin (email/password).
 * Supabase handles session persistence and refresh tokens.
 */
export async function signInAdmin(email: string, password: string) {
  const supabase = createSupabaseClient();
  if (!supabase) throw new Error("Error de configuración. Contacta al administrador.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      throw new Error("Correo o contraseña incorrectos.");
    }
    throw new Error("Error al iniciar sesión. Intenta de nuevo.");
  }
  return data;
}

/**
 * Look up a waiter by cédula (without signing in).
 * Used to validate the cédula before showing the PIN keypad.
 * Returns the waiter's name and status, or null if not found.
 *
 * Uses a security definer RPC because the waiters table requires
 * authentication (RLS), but the login page has no session yet.
 */
export async function lookupWaiterByCedula(
  cedula: string,
): Promise<{ name: string; is_active: boolean } | null> {
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("lookup_waiter_by_cedula", {
    p_cedula: cedula,
  });

  if (error || !data || data.length === 0) return null;
  return data[0] as { name: string; is_active: boolean };
}

/**
 * Sign in as waiter (cédula + 4-digit PIN).
 * Creates a synthetic email and pads the PIN.
 */
export async function signInWaiter(cedula: string, pin: string) {
  const supabase = createSupabaseClient();
  if (!supabase) throw new Error("Error de configuración. Contacta al administrador.");

  const email = waiterEmail(cedula);
  const password = padPin(pin);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Supabase returns English errors — translate the common ones
    if (error.message.includes("Invalid login credentials")) {
      throw new Error("Cédula o PIN incorrecto.");
    }
    throw new Error("Error al iniciar sesión. Intenta de nuevo.");
  }

  // Fetch waiter profile to check if active and PIN needs changing
  const { data: waiter } = await supabase
    .from("waiters")
    .select("*")
    .eq("auth_id", data.user.id)
    .single();

  if (!waiter) {
    await supabase.auth.signOut();
    throw new Error("No se encontró el perfil del mesero.");
  }

  if (!(waiter as Waiter).is_active) {
    await supabase.auth.signOut();
    throw new Error("Esta cuenta está desactivada. Contacta al administrador.");
  }

  return { ...data, waiter: waiter as Waiter };
}

/**
 * Change waiter PIN (used for first-login flow and voluntary PIN change).
 * Updates the Supabase Auth password and the pin_changed flag.
 */
export async function changeWaiterPin(newPin: string) {
  const supabase = createSupabaseClient();
  if (!supabase) throw new Error("Error de configuración. Contacta al administrador.");

  if (!/^\d{4}$/.test(newPin)) {
    throw new Error("El PIN debe ser de 4 dígitos.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("No hay sesión activa.");

  // Update password in Supabase Auth
  const { error: updateError } = await supabase.auth.updateUser({
    password: padPin(newPin),
  });

  if (updateError) {
    throw new Error("Error al cambiar el PIN. Intenta de nuevo.");
  }

  // Mark PIN as changed in waiters table
  const { error: dbError } = await supabase
    .from("waiters")
    .update({ pin_changed: true })
    .eq("auth_id", userData.user.id);

  if (dbError) throw new Error("Error al guardar el cambio. Intenta de nuevo.");
}

/**
 * Sign out the current user (works for both admin and waiter).
 */
export async function signOut() {
  const supabase = createSupabaseClient();
  if (!supabase) return;

  await supabase.auth.signOut();
}

/**
 * Get the current authenticated user's role.
 * Returns null if not authenticated.
 */
export async function getCurrentRole(): Promise<AuthRole | null> {
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const role = data.user.app_metadata?.role as AuthRole | undefined;
  return role ?? null;
}

/**
 * Get the current waiter profile (if logged in as waiter).
 * Returns null if not a waiter or not authenticated.
 */
export async function getCurrentWaiter(): Promise<Waiter | null> {
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: waiter } = await supabase
    .from("waiters")
    .select("*")
    .eq("auth_id", userData.user.id)
    .single();

  return (waiter as Waiter) ?? null;
}
