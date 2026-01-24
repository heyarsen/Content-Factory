import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const profileCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000

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
  const cached = profileCache.get(userId)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  if (forceRefresh) profileCache.delete(userId)

  try {
    console.log('[Auth] FETCH START:', { userId, email: userEmail })
    const isAdminEmail = userEmail === 'heyarsen@icloud.com'

    const [profileRes, subRes] = await Promise.all([
      supabase.from('user_profiles').select('role, has_active_subscription').eq('id', userId).maybeSingle(),
      supabase.from('user_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ])

    const profileData = profileRes.data
    const latestSub = subRes.data
    const role = isAdminEmail ? 'admin' : (profileData?.role || 'user')
    let hasActiveSubscription = false
    let debugReason = 'UNKNOWN'

    if (role === 'admin') {
      hasActiveSubscription = true
      debugReason = 'Admin Bypass'
    } else if (latestSub) {
      const isStatusValid = ['active', 'pending'].includes(latestSub.status)
      let isExpired = false
      if (latestSub.expires_at) {
        isExpired = new Date(latestSub.expires_at).getTime() < Date.now()
      }
      hasActiveSubscription = isStatusValid && !isExpired
      debugReason = `Sub Table: ${latestSub.status}${isExpired ? ' (EXPIRED)' : ''}`
    } else if (profileData?.has_active_subscription) {
      hasActiveSubscription = true
      debugReason = 'Profile Flag (Legacy)'
    } else {
      hasActiveSubscription = false
      debugReason = 'No active records'
    }

    const result = { role, hasActiveSubscription, debugReason, rawLatestSub: latestSub }
    console.log('[Auth] FETCH COMPLETE:', result)
    profileCache.set(userId, { data: result, timestamp: Date.now() })
    return result
  } catch (err) {
    console.error('[Auth] FETCH ERROR:', err)
    return { role: 'user', hasActiveSubscription: false, debugReason: 'Error occurred' }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    // 1. Immediate restore from storage
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        setLoading(false)
        fetchUserRoleAndSubscription(parsed.id, parsed.email).then(profile => {
          if (mounted) {
            const updated = { ...parsed, ...profile }
            localStorage.setItem('auth_user', JSON.stringify(updated))
            setUser(updated)
          }
        })
      } catch (e) { localStorage.removeItem('auth_user') }
    }

    // 2. Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Listener: ${event}`, !!session)
      if (!mounted) return

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
        const profile = await fetchUserRoleAndSubscription(session.user.id, session.user.email!)
        if (mounted) {
          const userObj = { ...session.user, ...profile } as User
          localStorage.setItem('auth_user', JSON.stringify(userObj))
          setUser(userObj)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('access_token')
        setUser(null)
        setLoading(false)
      } else {
        // Fallback for loading state
        if (mounted) setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (e: string, p: string, l?: string) => { await api.post('/api/auth/signup', { email: e, password: p, preferredLanguage: l }) }

  const signIn = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password }, { timeout: 5000 })
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)
      // JUST set session. The listener will handle state.
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token || data.access_token })
    }
  }

  const signOut = async () => {
    if (user?.id) profileCache.delete(user.id)
    localStorage.removeItem('auth_user')
    localStorage.removeItem('access_token')
    setUser(null)
    await supabase.auth.signOut()
  }

  const refreshSubscriptionStatus = async () => {
    if (!user?.id) return { hasActiveSubscription: false, role: 'user' }
    const profile = await fetchUserRoleAndSubscription(user.id, user.email, true)
    if (user) {
      const updated = { ...user, ...profile }
      localStorage.setItem('auth_user', JSON.stringify(updated))
      setUser(updated as User)
    }
    return { hasActiveSubscription: profile.hasActiveSubscription, role: profile.role, debugReason: profile.debugReason }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } })
    if (error) throw error
  }

  const resetPassword = async (email: string) => { await api.post('/api/auth/reset-password', { email }) }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword, refreshSubscriptionStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
