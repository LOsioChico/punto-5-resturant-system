#!/usr/bin/env node
/**
 * Create the admin user with the role already set in app_metadata.
 *
 * Usage:
 *   node scripts/create-admin.mjs <email> <password>
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (not committed).
 * The service role key bypasses RLS and can set app_metadata.
 *
 * After running this, disable public sign-ups in:
 *   Supabase Dashboard → Authentication → Sign In / Providers → Email
 *   → Turn off "Allow new users to sign up"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency for a one-off script)
function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) process.env[match[1]] ??= match[2].trim();
    }
  } catch {
    // .env not found — rely on existing env vars
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  console.error("You can find the service role key in Supabase Dashboard → Settings → API");
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    // Update existing user: set role and password
    console.log(`User ${email} already exists. Updating role and password...`);
    const { error } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      app_metadata: { role: "admin" },
    });
    if (error) {
      console.error("Error updating user:", error.message);
      process.exit(1);
    }
    console.log(`Admin user updated: ${email}`);
  } else {
    // Create new admin user with role set at creation time
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation
      app_metadata: { role: "admin" },
    });
    if (error) {
      console.error("Error creating user:", error.message);
      process.exit(1);
    }
    console.log(`Admin user created: ${email} (id: ${data.user.id})`);
  }

  console.log("\nNext step: disable public sign-ups in Supabase Dashboard:");
  console.log("  Authentication → Sign In / Providers → Email");
  console.log("  → Turn OFF 'Allow new users to sign up'");
}

main();
