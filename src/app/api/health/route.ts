/**
 * Health check endpoint — pings the Supabase database to keep it awake.
 *
 * Supabase Free tier pauses projects after 7 days of inactivity.
 * This endpoint is called daily via Vercel Cron (see vercel.json).
 * A single daily ping is enough to prevent auto-pausing.
 *
 * Also useful as a general health check: returns DB status + timestamp.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { status: "error", error: "Missing Supabase env vars", timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }

  try {
    // Simple query — just count categories (cheapest possible DB hit)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/categories?select=id&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        // Short timeout — don't let the function hang
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", error: `Supabase returned ${res.status}`, timestamp: new Date().toISOString() },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err), timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
