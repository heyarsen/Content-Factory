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
  isAdmin: boolean
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshAdminStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkAdminStatus = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        console.log('[Admin Check] No token found')
        return false
      }
      
      console.log('[Admin Check] Checking admin status...')
      const response = await api.get('/api/admin/check', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const isAdmin = response.data.isAdmin || false
      console.log('[Admin Check] Admin status:', isAdmin, 'Response:', response.data)
      return isAdmin
    } catch (error: any) {
      console.error('[Admin Check] Failed to check admin status:', error)
      console.error('[Admin Check] Error details:', error.response?.data || error.message)
      return false
    }
  }

  const refreshAdminStatus = async () => {
    if (user) {
      const adminStatus = await checkAdminStatus()
      setIsAdmin(adminStatus)
      console.log('[Admin Refresh] Updated admin status to:', adminStatus)
    }
  }

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as User)
        localStorage.setItem('access_token', session.access_token)
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)
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
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)
      } else {
        setUser(null)
        setIsAdmin(false)
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
    const { data } = await api.post('/api/auth/login', { email, password })
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)
      setUser(data.user)
      // Set session in Supabase client
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      // Check admin status after login
      if (data.user?.id) {
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)
      }
    }
  }

  const signOut = async () => {
    await api.post('/api/auth/logout')
    await supabase.auth.signOut()
    setUser(null)
    localStorage.removeItem('access_token')
  }

  const resetPassword = async (email: string) => {
    await api.post('/api/auth/reset-password', { email })
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signUp, signIn, signOut, resetPassword, refreshAdminStatus }}>
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

