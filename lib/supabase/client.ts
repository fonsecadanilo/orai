import { createClient } from "@supabase/supabase-js";

// Credenciais do projeto orai-app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kruekfsepwkzezqbgwfc.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydWVrZnNlcHdremV6cWJnd2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY4MzUsImV4cCI6MjA4MDgwMjgzNX0.GTkxjT0iPx-tpvkd0TmFlNQAnCO8FwCh7ZRQbGGH2YM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para verificar se o Supabase está configurado
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// URL base para Edge Functions
export const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
