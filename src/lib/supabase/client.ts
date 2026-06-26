import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — used by client components for realtime
 * subscriptions and mutations. No auth in this POC; the publishable
 * key with permissive RLS (see supabase/schema.sql) is enough.
 *
 * Returns null if env vars are missing so the build doesn't crash
 * during static generation. Components show a friendly error instead.
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return createBrowserClient(url, publishableKey);
}
