import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

interface User {
  id: string
  email: string
  email_confirmed_at?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as User)
        localStorage.setItem('access_token', session.access_token)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user as User)
        localStorage.setItem('access_token', session.access_token)
      } else {
        setUser(null)
        localStorage.removeItem('access_token')
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    await api.post('/api/auth/signup', { email, password })
    // User will be confirmed via email verification
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)
        setUser(data.user)
        // Set session in Supabase client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || data.access_token,
        })
        if (sessionError) {
          console.error('Failed to set Supabase session:', sessionError)
          // Continue anyway since we have the token
        }
      } else {
        throw new Error('No access token received from server')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
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

  const resetPassword = async (email: string) => {
    await api.post('/api/auth/reset-password', { email })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword }}>
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

