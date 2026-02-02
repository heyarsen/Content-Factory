import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

// Helper function to create a fetch with timeout
function createFetchWithTimeout(timeoutMs: number = 20000) {
  return async (url: string, options: any = {}) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`)
      }
      throw error
    }
  }
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  // Create fetch with shorter timeout (20 seconds)
  const customFetch = createFetchWithTimeout(20000)

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch as any,
      headers: {
        'x-client-info': 'content-factory-backend',
      },
    },
  })

  return supabaseClient
}

// Get a Supabase client with user's JWT token for RLS to work properly
export function getSupabaseClientForUser(userJWT: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY'
    )
  }

  // Create fetch with shorter timeout (20 seconds)
  const customFetch = createFetchWithTimeout(20000)

  // Create client with user's JWT token in headers for RLS
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch as any,
      headers: {
        Authorization: `Bearer ${userJWT}`,
        'x-client-info': 'content-factory-backend',
      },
    },
  })

  // Also try to set the session
  client.auth.setSession({
    access_token: userJWT,
    refresh_token: userJWT,
  }).catch(() => {
    // Ignore errors - headers should work
  })

  return client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient]
  },
})

