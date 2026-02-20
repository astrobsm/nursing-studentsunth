import { createClient } from "@supabase/supabase-js";

// Server-side client (for API routes) — uses service_role key
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Client-side Supabase (for browser) — uses anon key
let browserClient: ReturnType<typeof createClient> | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase client environment variables");
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// Check if Supabase is configured (server-side only — used in API routes)
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
