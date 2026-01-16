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

    // FIRST: Check our own storage - this is the source of truth
    const token = localStorage.getItem('access_token')
    const storedUser = localStorage.getItem('auth_user')
    
    console.log('[Auth] Init: Checking storage...', { hasToken: !!token, hasStoredUser: !!storedUser })

    if (token && storedUser) {
      // Restore immediately from our storage
      try {
        const user = JSON.parse(storedUser)
        console.log('[Auth] Restored user from localStorage:', user.email)
        setUser(user)
        setLoading(false)
        
        // Optionally sync with Supabase in the background (non-blocking)
        supabase.auth.setSession({
          access_token: token,
          refresh_token: token,
        }).catch(err => console.warn('[Auth] Supabase sync failed (non-blocking):', err.message))
      } catch (e) {
        console.error('[Auth] Failed to parse stored user:', e)
        localStorage.removeItem('access_token')
        localStorage.removeItem('auth_user')
        setLoading(false)
      }
    } else {
      // No stored session, check Supabase as fallback
      console.log('[Auth] No stored session, checking Supabase...')
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (mounted && session?.user) {
            console.log('[Auth] Found Supabase session, storing it...')
            const user = {
              ...session.user,
              role: 'user'
            } as User
            localStorage.setItem('access_token', session.access_token)
            localStorage.setItem('auth_user', JSON.stringify(user))
            setUser(user)
          } else {
            console.log('[Auth] No session found')
          }
        })
        .catch(err => console.error('[Auth] Session check error:', err.message))
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }

    // Listen for auth changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state change event:', event, session?.user?.id)
      
      if (mounted) {
        if (session?.user) {
          const user = {
            ...session.user,
            role: 'user'
          } as User
          localStorage.setItem('access_token', session.access_token)
          localStorage.setItem('auth_user', JSON.stringify(user))
          setUser(user)
          setLoading(false)
        } else {
          console.log('[Auth] onAuthStateChange: clearing user')
          localStorage.removeItem('access_token')
          localStorage.removeItem('auth_user')
          setUser(null)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
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
        // Store user data for persistent session
        localStorage.setItem('auth_user', JSON.stringify(data.user))
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
    
    // Clear our auth storage
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    
    // Clear all Supabase session keys from both storages
    const keysToRemove = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))
      .filter((key): key is string => key !== null && (key.startsWith('sb-') || key === 'supabase.auth.token'))
    keysToRemove.forEach(key => sessionStorage.removeItem(key))
    
    const localKeysToRemove = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((key): key is string => key !== null && (key.startsWith('sb-') || key === 'supabase.auth.token'))
    localKeysToRemove.forEach(key => localStorage.removeItem(key))
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

