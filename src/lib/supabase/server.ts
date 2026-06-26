import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client — used by server components / route handlers.
 * No auth in this POC; cookies are still wired for future use.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y complétalas.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
