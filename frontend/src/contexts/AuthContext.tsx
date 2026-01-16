import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

interface User {
  id: string
  email: string
  email_confirmed_at?: string
  role?: 'user' | 'admin'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, preferredLanguage?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    // Failsafe: If nothing happens within 5 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Initialization timed out, forcing loading to false')
        setLoading(false)
      }
    }, 5000)

    const fetchProfileWithTimeout = async (userId: string, retries = 3): Promise<{ data: { role?: 'user' | 'admin' } | null, error: any }> => {
      const attemptFetch = async (attempt: number): Promise<any> => {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile fetch timed out')), 8000)
          })

          console.log(`[Auth] Fetching profile for ${userId} (attempt ${4 - attempt})...`)
          const fetchPromise = supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single()

          const result: any = await Promise.race([fetchPromise, timeoutPromise])
          if (result.error) throw result.error
          return result
        } catch (error: any) {
          if (attempt > 0) {
            console.warn(`[Auth] Profile fetch failed, retrying...`, error)
            await new Promise(r => setTimeout(r, 1500))
            return attemptFetch(attempt - 1)
          }
          throw error
        }
      }

      return attemptFetch(retries)
    }

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (mounted && session?.user) {
          // Primary source of truth for role: Backend API (uses service role)
          try {
            console.log('[Auth] Fetching user profile from backend API...')
            const { data } = await api.get('/api/auth/me')
            if (mounted && data.user) {
              setUser(data.user)
              localStorage.setItem('access_token', session.access_token)
              setLoading(false)
              clearTimeout(safetyTimeout)
              return
            }
          } catch (apiError) {
            console.warn('[Auth] Backend profile fetch failed, falling back to direct Supabase query:', apiError)
          }

          // Fallback: Direct Supabase query
          try {
            const { data: profile } = await fetchProfileWithTimeout(session.user.id)

            if (mounted) {
              setUser({
                ...session.user,
                role: profile?.role || 'user'
              } as User)
              localStorage.setItem('access_token', session.access_token)
            }
          } catch (profileError) {
            console.warn('[Auth] All profile fetch attempts failed, using default role:', profileError)
            if (mounted) {
              setUser({
                ...session.user,
                role: 'user'
              } as User)
              localStorage.setItem('access_token', session.access_token)
            }
          }
        }
      } catch (error) {
        console.error('Error loading initial session:', error)
      } finally {
        if (mounted) {
          setLoading(false)
          clearTimeout(safetyTimeout)
        }
      }
    }).catch((err: any) => {
      console.error('Get session error:', err)
      if (mounted) {
        setLoading(false)
        clearTimeout(safetyTimeout)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Auth state change: ${event}`, session?.user?.id)

      try {
        if (session?.user) {
          try {
            // First try backend API (service role bypass)
            try {
              const { data } = await api.get('/api/auth/me')
              if (mounted && data.user) {
                setUser(data.user)
                localStorage.setItem('access_token', session.access_token)
                return
              }
            } catch (error) {
              console.warn('[Auth] Auth change profile API fetch failed, falling back to direct query')
            }

            const { data: profile } = await fetchProfileWithTimeout(session.user.id)

            if (mounted) {
              setUser(prevUser => {
                // Determine the new role: 
                // 1. If we got a profile, use its role
                // 2. If it's the same user as before, keep the existing role
                // 3. Otherwise default to 'user'
                const newRole = profile?.role || (prevUser?.id === session.user.id ? prevUser.role : 'user')

                return {
                  ...session.user,
                  role: newRole
                } as User
              })
              localStorage.setItem('access_token', session.access_token)
            }
          } catch (profileError) {
            console.warn('[Auth] Auth change profile load failed/timed out:', profileError)

            if (mounted) {
              setUser(prevUser => {
                const existingRole = prevUser?.id === session.user.id ? prevUser.role : 'user'
                return {
                  ...session.user,
                  role: existingRole
                } as User
              })
              localStorage.setItem('access_token', session.access_token)
            }
          }
        } else if (mounted) {
          console.log('[Auth] No session user, clearing state')
          setUser(null)
          localStorage.removeItem('access_token')
        }
      } catch (error) {
        console.error('Error handling auth change:', error)
      } finally {
        if (mounted) {
          setLoading(false)
          clearTimeout(safetyTimeout)
        }
      }
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, preferredLanguage?: string) => {
    await api.post('/api/auth/signup', { email, password, preferredLanguage })
    // User will be confirmed via email verification
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Attempting to sign in...')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      console.log('[Auth] API URL:', API_URL)

      // Use a shorter timeout for login specifically (15 seconds)
      const { data } = await api.post('/api/auth/login', { email, password }, { timeout: 15000 })
      console.log('[Auth] Login response received:', { hasToken: !!data.access_token, hasUser: !!data.user })

      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)
        setUser(data.user)

        // Log before setting session
        console.log('[Auth] Setting Supabase session...')

        // Set session in Supabase client with a timeout race
        try {
          const sessionPromise = supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || data.access_token,
          })

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase session set timeout')), 8000)
          )

          await Promise.race([sessionPromise, timeoutPromise])
            .then((result: any) => {
              if (result?.error) console.error('[Auth] Failed to set Supabase session:', result.error)
              else console.log('[Auth] Supabase session set successfully')
            })
            .catch(err => {
              console.warn('[Auth] Supabase session set warning:', err)
              // Don't fail login if session set fails/times out, we have the token
            })

          console.log('[Auth] Session setup complete, returning control to component')

        } catch (error) {
          console.error('[Auth] Unexpected error setting session:', error)
        }
      } else {
        console.error('[Auth] No access token in response:', data)
        throw new Error('No access token received from server')
      }
    } catch (error: any) {
      console.error('[Auth] Sign in error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        isNetworkError: !error.response,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method,
        }
      })
      // Re-throw to let the Login component handle the error
      throw error
    }
  }

  const signOut = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with sign out even if API call fails
    }
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Supabase sign out error:', error)
      // Continue with cleanup even if Supabase sign out fails
    }
    setUser(null)
    localStorage.removeItem('access_token')
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    await api.post('/api/auth/reset-password', { email })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

