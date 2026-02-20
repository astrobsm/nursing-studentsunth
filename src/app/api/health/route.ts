import { NextResponse } from "next/server";

// GET /api/health — Check if the server and Supabase are reachable
export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING";
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING";
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING";
  checks.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? "set" : "using default";

  // Try Supabase connection
  let supabaseOk = false;
  let supabaseError = "";
  try {
    const { createServerClient } = await import("@/lib/supabase");
    const supabase = createServerClient();
    const { error } = await supabase.from("candidates").select("id").limit(1);
    if (error) {
      supabaseError = error.message;
    } else {
      supabaseOk = true;
    }
  } catch (err) {
    supabaseError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: supabaseOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    envVars: checks,
    supabase: {
      connected: supabaseOk,
      error: supabaseError || null,
    },
  });
}
