import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

// Cache for user profile data to avoid repeated fetches
const profileCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface User {
  id: string
  email: string
  email_confirmed_at?: string
  role?: 'user' | 'admin'
  hasActiveSubscription?: boolean
  debugReason?: string // Renamed for safety
  rawLatestSub?: any   // Added for debug
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, preferredLanguage?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshSubscriptionStatus: () => Promise<{ hasActiveSubscription: boolean; role: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Optimized function to fetch user role and subscription with caching
const fetchUserRoleAndSubscription = async (userId: string, forceRefresh: boolean = false) => {
  // Check cache first (unless force refresh is requested)
  const cached = profileCache.get(userId)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[Auth] Using cached profile data')
    return cached.data
  }

  // Clear cache if force refresh
  if (forceRefresh && userId) {
    profileCache.delete(userId)
    console.log('[Auth] Cache cleared for force refresh')
  }

  try {
    console.log('[Auth] NUCLEAR FETCH START for user:', userId)

    // 1. Get user email from Supabase Auth to check for admin
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const userEmail = authUser?.email
    const isAdminEmail = userEmail === 'heyarsen@icloud.com'

    // 2. Query user_profiles and the LATEST subscription record
    const results = await Promise.allSettled([
      supabase
        .from('user_profiles')
        .select('role, has_active_subscription')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_subscriptions')
        .select('*') // Get everything for debug
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const profileData = results[0].status === 'fulfilled' ? (results[0].value as any).data : null
    const latestSub = results[1].status === 'fulfilled' ? (results[1].value as any).data : null

    console.log('[Auth] RAW DB DATA:', { profileData, latestSub })

    const role = isAdminEmail ? 'admin' : (profileData?.role || 'user')
    let hasActiveSubscription = false
    let debugReason = 'UNSET'

    if (role === 'admin') {
      hasActiveSubscription = true
      debugReason = 'Admin Bypass'
    } else if (latestSub) {
      // Logic for active subscription
      const isStatusValid = ['active', 'pending'].includes(latestSub.status)

      // Check for expiration if it exists
      let isExpired = false
      if (latestSub.expires_at) {
        isExpired = new Date(latestSub.expires_at).getTime() < Date.now()
      }

      hasActiveSubscription = isStatusValid && !isExpired
      debugReason = `Sub Table: ${latestSub.status}${isExpired ? ' (EXPIRED)' : ''}`
      console.log(`[Auth] Determined from Sub Table: ${latestSub.status}, Expired: ${isExpired} -> Active: ${hasActiveSubscription}`)
    } else if (profileData?.has_active_subscription) {
      // ONLY use profile flag if NO subscription record exists at all
      hasActiveSubscription = true
      debugReason = 'Profile Flag (No sub record found)'
      console.log('[Auth] Determined from Profile Flag')
    } else {
      hasActiveSubscription = false
      debugReason = 'No records found'
      console.log('[Auth] No active sub records found')
    }

    const result = {
      role,
      hasActiveSubscription,
      debugReason,
      rawLatestSub: latestSub
    }
    console.log('[Auth] NUCLEAR FETCH RESULT:', result)

    profileCache.set(userId, { data: result, timestamp: Date.now() })
    return result
  } catch (err) {
    console.error('[Auth] NUCLEAR FETCH ERROR:', err)
    return { role: 'user', hasActiveSubscription: false, debugReason: 'Critical Error' }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null

    // FIRST: Check our own storage - this is the source of truth
    const token = localStorage.getItem('access_token')
    const storedUser = localStorage.getItem('auth_user')

    console.log('[Auth] Init: Checking storage...', { hasToken: !!token, hasStoredUser: !!storedUser })

    if (storedUser) {
      // Try to restore from localStorage
      try {
        const parsedUser = JSON.parse(storedUser)
        console.log('[Auth] Restored user from localStorage:', { email: parsedUser.email, role: parsedUser.role })
        setUser(parsedUser)
        setLoading(false) // Set loading false immediately

        // Fetch actual role and subscription status from database in background (non-blocking)
        fetchUserRoleAndSubscription(parsedUser.id).then(profile => {
          if (mounted) {
            const updatedUser = {
              ...parsedUser,
              role: profile.role as 'user' | 'admin',
              hasActiveSubscription: profile.hasActiveSubscription || false,
              debugReason: profile.debugReason,
              rawLatestSub: profile.rawLatestSub
            }
            localStorage.setItem('auth_user', JSON.stringify(updatedUser))
            setUser(updatedUser)
            console.log('[Auth] Background fetch updated state')
          }
        })
      } catch (e) {
        console.error('[Auth] Failed to parse stored user:', e)
        localStorage.removeItem('access_token')
        localStorage.removeItem('auth_user')
        setLoading(false)
      }
    } else {
      // No stored session, check Supabase as fallback with timeout
      console.log('[Auth] No stored session, checking Supabase...')

      // Set a 1 second timeout - faster fallback for better UX
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.log('[Auth] Supabase session check timed out, assuming logged out')
          setLoading(false)
        }
      }, 1000)

      supabase.auth.getSession()
        .then(async ({ data: { session } }) => {
          if (timeoutId) clearTimeout(timeoutId)

          if (mounted && session?.user) {
            console.log('[Auth] Found Supabase session, fetching profile...')

            const profile = await fetchUserRoleAndSubscription(session.user.id)
            if (mounted) {
              const user = {
                ...session.user,
                role: profile.role,
                hasActiveSubscription: profile.hasActiveSubscription,
                debugReason: profile.debugReason,
                rawLatestSub: profile.rawLatestSub
              } as User
              localStorage.setItem('access_token', session.access_token)
              localStorage.setItem('auth_user', JSON.stringify(user))
              setUser(user)
            }
          }
          if (mounted) setLoading(false)
        })
        .catch(err => {
          if (timeoutId) clearTimeout(timeoutId)
          console.error('[Auth] Session check error:', err.message)
          if (mounted) setLoading(false)
        })
    }

    // Listen for auth changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange event:', event)

      if (mounted) {
        if (session?.user) {
          const profile = await fetchUserRoleAndSubscription(session.user.id)
          if (mounted) {
            const user = {
              ...session.user,
              role: profile.role,
              hasActiveSubscription: profile.hasActiveSubscription,
              debugReason: profile.debugReason,
              rawLatestSub: profile.rawLatestSub
            } as User
            localStorage.setItem('access_token', session.access_token)
            localStorage.setItem('auth_user', JSON.stringify(user))
            setUser(user)
            setLoading(false)
          }
        } else {
          localStorage.removeItem('access_token')
          localStorage.removeItem('auth_user')
          setUser(null)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, preferredLanguage?: string) => {
    await api.post('/api/auth/signup', { email, password, preferredLanguage })
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Attempting to sign in...')
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const { data } = await api.post('/api/auth/login', { email, password }, { timeout: 5000 })

      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)

        // Set user immediately with basic data
        let userWithDefaults = {
          ...data.user,
          role: 'user' as const,
          hasActiveSubscription: false,
          debugReason: 'SIGN_IN_CHECKING'
        }
        setUser(userWithDefaults)
        localStorage.setItem('auth_user', JSON.stringify(userWithDefaults))

        // Fetch role/sub in background
        fetchUserRoleAndSubscription(data.user.id).then(profile => {
          const updatedUser = {
            ...data.user,
            role: profile.role,
            hasActiveSubscription: profile.hasActiveSubscription,
            debugReason: profile.debugReason,
            rawLatestSub: profile.rawLatestSub
          }
          localStorage.setItem('auth_user', JSON.stringify(updatedUser))
          setUser(updatedUser)
          console.log('[Auth] Login complete, profile synced')
        })

        // Also set session in supabase client
        try {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || data.access_token,
          })
        } catch (e) {
          console.warn('[Auth] Supabase session set warning')
        }
      }
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error.message)
      throw error
    }
  }

  const signOut = async () => {
    console.log('[Auth] Starting sign out...')
    if (user?.id) profileCache.delete(user.id)
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    try { await supabase.auth.signOut() } catch (e) { }
    try { await api.post('/api/auth/logout') } catch (e) { }
    console.log('[Auth] Sign out complete')
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    await api.post('/api/auth/reset-password', { email })
  }

  const refreshSubscriptionStatus = async () => {
    if (!user?.id) return { hasActiveSubscription: false, role: 'user' }
    console.log('[Auth] refreshSubscriptionStatus: FORCING REFRESH')
    try {
      const profile = await fetchUserRoleAndSubscription(user.id, true)
      const updatedUser = {
        ...user,
        role: profile.role,
        hasActiveSubscription: profile.hasActiveSubscription,
        debugReason: profile.debugReason,
        rawLatestSub: profile.rawLatestSub
      }
      localStorage.setItem('auth_user', JSON.stringify(updatedUser))
      setUser(updatedUser as User)
      return { hasActiveSubscription: profile.hasActiveSubscription, role: profile.role }
    } catch (error) {
      console.error('[Auth] refreshSubscriptionStatus error:', error)
      return { hasActiveSubscription: false, role: user?.role || 'user' }
    }
  }

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
