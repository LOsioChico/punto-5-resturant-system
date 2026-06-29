// Supabase Edge Function — admin manages waiter accounts
//
// Endpoints:
//   POST /create-waiter  — create a new waiter auth account + profile
//   POST /toggle-waiter  — activate/deactivate a waiter
//   POST /delete-waiter  — soft delete a waiter (sets deleted_at, deactivates)
//   GET  /list-waiters   — list all non-deleted waiters
//
// Requires: admin JWT (app_metadata.role = 'admin')
//
// Env vars:
//   SUPABASE_URL              — project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key for auth admin operations

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PIN_PREFIX = "p5";
const INITIAL_PIN = "0000";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Verify the caller is an admin by checking their JWT. */
async function verifyAdmin(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  // Use the service role key to call getUser with the user's token.
  // The second arg to createClient is the API key (service role),
  // and auth.getUser(token) verifies the user's JWT.
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;

  const role = user.app_metadata?.role;
  if (role !== "admin") return null;

  return user;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const user = await verifyAdmin(req.headers.get("Authorization"));
  if (!user) {
    return json({ error: "Unauthorized — admin access required" }, 401);
  }

  // Service role client for admin operations
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // POST /create-waiter
  if (method === "POST" && path.endsWith("/create-waiter")) {
    const { cedula, name } = await req.json();
    if (!cedula || !name) {
      return json({ error: "cedula and name are required" }, 400);
    }
    if (!/^\d+$/.test(cedula)) {
      return json({ error: "cedula must contain only digits" }, 400);
    }

    // Check if cedula already exists (only among non-deleted waiters)
    const { data: existing } = await admin
      .from("waiters")
      .select("id")
      .eq("cedula", cedula)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return json({ error: "Ya existe un mesero con esta cédula" }, 409);
    }

    // Create auth account with synthetic email + initial PIN
    const email = `${cedula}@punto5.co`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: PIN_PREFIX + INITIAL_PIN,
      email_confirm: true, // skip email verification
      user_metadata: { name, cedula, role: "waiter" },
      app_metadata: { role: "waiter" },
    });

    if (authError) {
      return json({ error: authError.message }, 400);
    }

    // Create waiter profile
    const { error: profileError } = await admin
      .from("waiters")
      .insert({
        auth_id: authData.user.id,
        cedula,
        name,
        is_active: true,
        pin_changed: false,
        created_by: user.email ?? null,
      });

    if (profileError) {
      // Rollback: delete the auth account
      await admin.auth.admin.deleteUser(authData.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({
      id: authData.user.id,
      cedula,
      name,
      email,
      initial_pin: INITIAL_PIN,
      message: "Mesero creado. El PIN inicial es 0000 y debe cambiarse en el primer login.",
    });
  }

  // POST /toggle-waiter
  if (method === "POST" && path.endsWith("/toggle-waiter")) {
    const { waiter_id, is_active } = await req.json();
    if (!waiter_id || typeof is_active !== "boolean") {
      return json({ error: "waiter_id and is_active are required" }, 400);
    }

    const { error } = await admin
      .from("waiters")
      .update({ is_active })
      .eq("id", waiter_id);

    if (error) return json({ error: error.message }, 400);

    return json({ id: waiter_id, is_active });
  }

  // POST /delete-waiter — soft delete (set deleted_at, deactivate, disable auth)
  if (method === "POST" && path.endsWith("/delete-waiter")) {
    const { waiter_id } = await req.json();
    if (!waiter_id) {
      return json({ error: "waiter_id is required" }, 400);
    }

    // Soft delete: set deleted_at and deactivate
    const { error } = await admin
      .from("waiters")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", waiter_id)
      .is("deleted_at", null); // prevent double-delete

    if (error) return json({ error: error.message }, 400);

    // Also disable the auth account so the waiter can't log in anymore
    const { data: waiter } = await admin
      .from("waiters")
      .select("auth_id")
      .eq("id", waiter_id)
      .single();

    if (waiter?.auth_id) {
      await admin.auth.admin.updateUserById(waiter.auth_id, { ban_duration: "876000h" });
    }

    return json({ id: waiter_id, deleted: true });
  }

  // GET /list-waiters — only non-deleted waiters
  if (method === "GET" && path.endsWith("/list-waiters")) {
    const { data, error } = await admin
      .from("waiters")
      .select("id, cedula, name, is_active, pin_changed, created_at, created_by")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return json({ error: error.message }, 400);

    return json(data);
  }

  return json({ error: "Not found" }, 404);
});
