import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const profileCache = new Map<string, { data: any; timestamp: number }>()

interface User {
  id: string
  email: string
  email_confirmed_at?: string
  role?: 'user' | 'admin'
  hasActiveSubscription?: boolean
  debugReason?: string
  rawLatestSub?: any
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, preferredLanguage?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshSubscriptionStatus: () => Promise<{ hasActiveSubscription: boolean; role: string; debugReason?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const fetchUserRoleAndSubscription = async (userId: string, userEmail: string, forceRefresh: boolean = false) => {
  if (forceRefresh) profileCache.delete(userId)
  const cached = profileCache.get(userId)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 300000) return cached.data

  try {
    const [profileRes, subRes] = await Promise.all([
      supabase.from('user_profiles').select('role, has_active_subscription').eq('id', userId).maybeSingle(),
      supabase.from('user_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ])

    const profileData = profileRes.data
    const latestSub = subRes.data
    const isAdmin = userEmail === 'heyarsen@icloud.com' || profileData?.role === 'admin'

    let hasActive = false
    let reason = 'NONE'

    if (isAdmin) {
      hasActive = true; reason = 'Admin'
    } else if (latestSub) {
      const active = ['active', 'pending'].includes(latestSub.status)
      const expired = latestSub.expires_at && new Date(latestSub.expires_at).getTime() < Date.now()
      hasActive = active && !expired
      reason = `Sub: ${latestSub.status}${expired ? ' (EXP)' : ''}`
    } else {
      // No sub record found and not admin
      hasActive = false
      reason = 'No Sub Record'
    }

    const res = { role: isAdmin ? 'admin' : 'user', hasActiveSubscription: hasActive, debugReason: reason, rawLatestSub: latestSub }
    profileCache.set(userId, { data: res, timestamp: Date.now() })
    return res
  } catch (err) {
    console.error('[Auth] Fetch Error:', err)
    return { role: 'user', hasActiveSubscription: false, debugReason: 'Error' }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Restore from storage
    const stored = localStorage.getItem('auth_user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setUser(u)
        setLoading(false)
        fetchUserRoleAndSubscription(u.id, u.email).then(p => {
          if (mounted) setUser(prev => prev ? { ...prev, ...p } : null)
        })
      } catch (e) { localStorage.removeItem('auth_user') }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        if (session.access_token) {
          localStorage.setItem('access_token', session.access_token)
        }

        if (event !== 'SIGNED_OUT') {
          const p = await fetchUserRoleAndSubscription(session.user.id, session.user.email!)
          if (mounted) {
            const uObj = { ...session.user, ...p } as User
            localStorage.setItem('auth_user', JSON.stringify(uObj))
            setUser(uObj)
            setLoading(false)
          }
        }
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('access_token')
        setUser(null)
        setLoading(false)
      } else {
        if (mounted) setLoading(false)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const signIn = async (e: string, p: string) => {
    const { data } = await api.post('/api/auth/login', { email: e, password: p })
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token || data.access_token })
    }
  }

  const signOut = async () => {
    localStorage.removeItem('auth_user')
    localStorage.removeItem('access_token')
    setUser(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, loading, signOut, signIn,
      signUp: async (e, p, l) => { await api.post('/api/auth/signup', { email: e, password: p, preferredLanguage: l }) },
      signInWithGoogle: async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } }) },
      resetPassword: async (e) => { await api.post('/api/auth/reset-password', { email: e }) },
      refreshSubscriptionStatus: async () => {
        if (!user) return { hasActiveSubscription: false, role: 'user' }
        const p = await fetchUserRoleAndSubscription(user.id, user.email, true)
        if (user) setUser({ ...user, ...p })
        return { hasActiveSubscription: p.hasActiveSubscription, role: p.role, debugReason: p.debugReason }
      }
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
