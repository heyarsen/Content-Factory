import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const profileCache = new Map<string, { data: any; timestamp: number }>()
const pendingFetches = new Map<string, Promise<any>>()

const ADMIN_EMAILS = new Set(
  ((import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || 'heyarsen@icloud.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

const isAdminEmail = (email?: string) => !!email && ADMIN_EMAILS.has(email.toLowerCase())

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
  signUp: (email: string, password: string, preferredLanguage?: string, referralCode?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshSubscriptionStatus: () => Promise<{ hasActiveSubscription: boolean; role: string; debugReason?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const fetchUserRoleAndSubscription = async (userId: string, userEmail: string, forceRefresh: boolean = false) => {
  const staleCachedData = profileCache.get(userId)?.data
  if (forceRefresh) profileCache.delete(userId)
  const cached = profileCache.get(userId)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 300000) return cached.data

  const existingFetch = pendingFetches.get(userId)
  if (existingFetch) {
    console.log(`[Auth] Fetch already in progress for ${userEmail}, returning existing promise...`)
    return existingFetch
  }

  console.log(`[Auth] Fetching role/sub for ${userEmail}...`)

  const fetchPromise = (async () => {
    // Add a 15-second timeout to the combined profile/sub fetch
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
    )

    try {
      const dbFetchPromise = Promise.all([
        supabase.from('user_profiles').select('role, has_active_subscription, subscription_status').eq('id', userId).maybeSingle(),
        supabase.from('user_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ])

      const [profileRes, subRes] = await Promise.race([dbFetchPromise, timeoutPromise]) as [any, any]

      const profileData = profileRes.data
      const latestSub = subRes.data
      const isAdmin = isAdminEmail(userEmail) || profileData?.role === 'admin'

      let hasActive = false
      let reason = 'NONE'

      const profileHasActive = profileData?.has_active_subscription === true
      const profileStatus = profileData?.subscription_status
      const profileStatusActive = ['active', 'trialing'].includes(profileStatus)

      if (isAdmin) {
        hasActive = true; reason = 'Admin'
      } else if (profileHasActive || profileStatusActive) {
        hasActive = true
        reason = profileHasActive ? 'Profile Flag' : `Profile Status: ${profileStatus}`
      } else if (latestSub) {
        const active = ['active', 'trialing', 'pending'].includes(latestSub.status)
        const paymentActive = latestSub.payment_status === 'completed'
        const expired = latestSub.expires_at && new Date(latestSub.expires_at).getTime() < Date.now()
        hasActive = (active || paymentActive) && !expired
        reason = `Sub: ${latestSub.status}${latestSub.payment_status ? `/${latestSub.payment_status}` : ''}${expired ? ' (EXP)' : ''}`
      } else {
        // No sub record found and not admin
        hasActive = false
        reason = 'No Sub Record'
      }

      const res = { role: isAdmin ? 'admin' : 'user', hasActiveSubscription: hasActive, debugReason: reason, rawLatestSub: latestSub }
      console.log(`[Auth] Role/sub fetched for ${userEmail}:`, { role: res.role, hasActive: res.hasActiveSubscription, reason })
      profileCache.set(userId, { data: res, timestamp: Date.now() })
      return res
    } catch (err: any) {
      console.error('[Auth] Profile Fetch Error or Timeout:', err)
      if (staleCachedData) {
        return {
          ...staleCachedData,
          debugReason: err.message === 'Profile fetch timeout' ? 'Timeout (cached profile)' : 'Error (cached profile)'
        }
      }

      return {
        role: isAdminEmail(userEmail) ? 'admin' : 'user',
        hasActiveSubscription: isAdminEmail(userEmail),
        debugReason: err.message === 'Profile fetch timeout' ? 'Timeout' : 'Error'
      }
    }
  })()

  pendingFetches.set(userId, fetchPromise)

  try {
    return await fetchPromise
  } finally {
    pendingFetches.delete(userId)
  }
}

/**
 * Apply pending referral code if one exists in localStorage.
 * This handles the case where a user signs up via Google OAuth
 * and the referral code was saved before the redirect.
 */
const applyPendingReferral = async () => {
  const pendingRef = localStorage.getItem('pending_referral_code')
  if (!pendingRef) return

  try {
    console.log(`[Auth] Applying pending referral code: ${pendingRef}`)
    await api.post('/api/referrals/apply', { referralCode: pendingRef })
    console.log(`[Auth] Referral code ${pendingRef} applied successfully`)
    localStorage.removeItem('pending_referral_code')
  } catch (err: any) {
    // If referral already applied or invalid, just clear it
    console.log(`[Auth] Referral apply result:`, err?.response?.data?.error || err.message)
    // Clear the pending code regardless - don't keep retrying
    localStorage.removeItem('pending_referral_code')
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

      try {
        if (session?.user) {
          if (session.access_token) {
            localStorage.setItem('access_token', session.access_token)
          }

          if (event !== 'SIGNED_OUT') {
            // IMMEDIATE: Set user with basic info so app can proceed
            const basicUser = { ...session.user } as User
            setUser(prev => prev ? { ...prev, ...basicUser } : basicUser)
            setLoading(false)

            // BACKGROUND: Fetch extra profile/sub info
            const p = await fetchUserRoleAndSubscription(session.user.id, session.user.email!)
            if (mounted) {
              const uObj = { ...session.user, ...p } as User
              localStorage.setItem('auth_user', JSON.stringify(uObj))
              setUser(uObj)
            }

            // Apply pending referral code (e.g. after Google OAuth redirect)
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              applyPendingReferral()
            }
          }
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('access_token')
          setUser(null)
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('[Auth Context] Error in listener:', err)
        setLoading(false)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const signIn = async (e: string, p: string) => {
    const { data } = await api.post('/api/auth/login', { email: e, password: p })
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)

      // If profile data is provided in the response, cache it
      if (data.user && data.profile) {
        console.log('[Auth] Profile data received in login response:', data.profile)
        profileCache.set(data.user.id, { data: data.profile, timestamp: Date.now() })
        const uObj = { ...data.user, ...data.profile } as User
        localStorage.setItem('auth_user', JSON.stringify(uObj))
        setUser(uObj)
      }

      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token || data.access_token })
    }
  }

  const signOut = async () => {
    console.log('[Auth] Signing out...')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('pending_referral_code')
    setUser(null)
    await supabase.auth.signOut()
  }

  const appUrl = (window.location.origin || import.meta.env.VITE_FRONTEND_URL || '').replace(/\/$/, '')

  return (
    <AuthContext.Provider value={{
      user, loading, signOut, signIn,
      signUp: async (e, p, l, r) => { await api.post('/api/auth/signup', { email: e, password: p, preferredLanguage: l, referralCode: r }) },
      signInWithGoogle: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${appUrl}/create` },
        })
      },
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
