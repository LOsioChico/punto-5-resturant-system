import { execSync } from "node:child_process";

/**
 * Playwright global setup — resets the local Supabase database before
 * every test run so tests start from a clean, deterministic state.
 *
 * Requires `supabase start` to be running (Docker).
 */
export default async function globalSetup() {
  try {
    execSync("supabase db reset", {
      stdio: "pipe",
      timeout: 30000,
    });
  } catch (err) {
    throw new Error(
      "Failed to reset local Supabase DB. Make sure `supabase start` is running.\n" +
        String(err),
    );
  }
}
