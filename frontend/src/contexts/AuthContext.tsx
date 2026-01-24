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

// Optimized function to fetch user role and subscription with caching
const fetchUserRoleAndSubscription = async (userId: string, userEmail: string, forceRefresh: boolean = false) => {
  // Check cache first (unless force refresh is requested)
  const cached = profileCache.get(userId)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[Auth] Using cached profile data')
    return cached.data
  }

  if (forceRefresh) {
    profileCache.delete(userId)
    console.log('[Auth] Cache cleared for force refresh')
  }

  try {
    console.log('[Auth] FETCH START:', { userId, email: userEmail })

    const isAdminEmail = userEmail === 'heyarsen@icloud.com'

    // Query user_profiles and the LATEST subscription record in parallel
    const [profileRes, subRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('role, has_active_subscription')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const profileData = profileRes.data
    const latestSub = subRes.data

    console.log('[Auth] DB DATA RECEIVED:', { profileData, latestSub })

    const role = isAdminEmail ? 'admin' : (profileData?.role || 'user')
    let hasActiveSubscription = false
    let debugReason = 'UNKNOWN'

    if (role === 'admin') {
      hasActiveSubscription = true
      debugReason = 'Admin Bypass'
    } else if (latestSub) {
      // THE MOST RECENT RECORD IS THE ABSOLUTE SOURCE OF TRUTH
      const isStatusValid = ['active', 'pending'].includes(latestSub.status)

      // Check for expiration
      let isExpired = false
      if (latestSub.expires_at) {
        isExpired = new Date(latestSub.expires_at).getTime() < Date.now()
      }

      hasActiveSubscription = isStatusValid && !isExpired
      debugReason = `Sub Table: ${latestSub.status}${isExpired ? ' (EXPIRED)' : ''}`
    } else if (profileData?.has_active_subscription) {
      // Fallback only if NO sub records exist
      hasActiveSubscription = true
      debugReason = 'Profile Flag (No sub record found)'
    } else {
      hasActiveSubscription = false
      debugReason = 'No active records'
    }

    const result = {
      role,
      hasActiveSubscription,
      debugReason,
      rawLatestSub: latestSub
    }
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
    let timeoutId: NodeJS.Timeout | null = null

    // Restore from localStorage
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        console.log('[Auth] Init from storage:', parsedUser.email)
        setUser(parsedUser)
        setLoading(false)

        fetchUserRoleAndSubscription(parsedUser.id, parsedUser.email).then(profile => {
          if (mounted) {
            const updatedUser = { ...parsedUser, ...profile }
            localStorage.setItem('auth_user', JSON.stringify(updatedUser))
            setUser(updatedUser)
            console.log('[Auth] Background refresh complete')
          }
        })
      } catch (e) {
        localStorage.removeItem('auth_user')
        setLoading(false)
      }
    } else {
      // Check Supabase if no storage
      timeoutId = setTimeout(() => { if (mounted) setLoading(false) }, 1500)
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (timeoutId) clearTimeout(timeoutId)
        if (mounted && session?.user) {
          const profile = await fetchUserRoleAndSubscription(session.user.id, session.user.email!)
          const userObj = { ...session.user, ...profile } as User
          localStorage.setItem('auth_user', JSON.stringify(userObj))
          setUser(userObj)
        }
        if (mounted) setLoading(false)
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event)
      if (mounted) {
        if (session?.user) {
          const profile = await fetchUserRoleAndSubscription(session.user.id, session.user.email!)
          const userObj = { ...session.user, ...profile } as User
          localStorage.setItem('auth_user', JSON.stringify(userObj))
          setUser(userObj)
          setLoading(false)
        } else {
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
    const { data } = await api.post('/api/auth/login', { email, password }, { timeout: 5000 })
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)
      // Defaults
      let userObj = { ...data.user, role: 'user', hasActiveSubscription: false, debugReason: 'FETCHING...' }
      setUser(userObj)
      localStorage.setItem('auth_user', JSON.stringify(userObj))

      // Final update
      const profile = await fetchUserRoleAndSubscription(data.user.id, data.user.email)
      const finalUser = { ...data.user, ...profile }
      localStorage.setItem('auth_user', JSON.stringify(finalUser))
      setUser(finalUser)

      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token || data.access_token })
    }
  }

  const signOut = async () => {
    if (user?.id) profileCache.delete(user.id)
    setUser(null)
    localStorage.removeItem('auth_user')
    localStorage.removeItem('access_token')
    await supabase.auth.signOut()
  }

  const refreshSubscriptionStatus = async () => {
    if (!user?.id) return { hasActiveSubscription: false, role: 'user' }
    console.log('[Auth] Manual refresh triggered')
    const profile = await fetchUserRoleAndSubscription(user.id, user.email, true)
    const updatedUser = { ...user, ...profile }
    localStorage.setItem('auth_user', JSON.stringify(updatedUser))
    setUser(updatedUser as User)
    return { hasActiveSubscription: profile.hasActiveSubscription, role: profile.role, debugReason: profile.debugReason }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle: async () => { }, signOut, resetPassword: async () => { }, refreshSubscriptionStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
