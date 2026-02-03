import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Missing Supabase environment variables'
  : null

const fallbackUrl = supabaseUrl ?? 'https://missing.supabase.co'
const fallbackAnonKey = supabaseAnonKey ?? 'missing-anon-key'

export const supabase = createClient(fallbackUrl, fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  }
})
