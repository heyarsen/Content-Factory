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
  subStatusReason?: string // New field for debugging
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
    console.log('[Auth] Fetching robust profile for user:', userId)

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
        .select('id, status, payment_status, created_at, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const profileData = results[0].status === 'fulfilled' ? (results[0].value as any).data : null
    const latestSub = results[1].status === 'fulfilled' ? (results[1].value as any).data : null

    console.log('[Auth] Raw query results:', {
      profileData,
      latestSub,
      resultsLength: results.length
    })

    const role = isAdminEmail ? 'admin' : (profileData?.role || 'user')
    let hasActiveSubscription = false
    let subStatusReason = 'PENDING_CHECK'

    console.log('[Auth] Debugging status determination:', {
      role,
      isAdminEmail,
      hasProfileFlag: profileData?.has_active_subscription,
      hasLatestSub: !!latestSub,
      latestSubStatus: latestSub?.status
    })

    if (role === 'admin') {
      hasActiveSubscription = true
      subStatusReason = 'Admin Bypass'
    } else if (latestSub) {
      // THE MOST RECENT RECORD IS THE SOURCE OF TRUTH
      const isAllowedStatus = ['active', 'pending'].includes(latestSub.status)
      hasActiveSubscription = isAllowedStatus
      subStatusReason = `Sub Table: ${latestSub.status}`
      console.log(`[Auth] Using Sub Table. Status: ${latestSub.status} -> Active: ${hasActiveSubscription}`)
    } else if (profileData?.has_active_subscription) {
      // ONLY use profile flag if NO subscription record exists at all
      hasActiveSubscription = true
      subStatusReason = 'Profile Flag (No sub record found)'
      console.log('[Auth] Using Profile Flag (Fallback)')
    } else {
      hasActiveSubscription = false
      subStatusReason = 'No active records'
      console.log('[Auth] No active sub found anywhere')
    }

    const result = { role, hasActiveSubscription, subStatusReason }
    console.log('[Auth] FINAL RESULT for state update:', result)

    console.log('[Auth] Robust profile check completed:', {
      userId,
      ...result,
      source: {
        profileHasSub: !!profileData?.has_active_subscription,
        latestSubStatus: latestSub?.status,
        profileRole: profileData?.role,
        isAdminEmail
      }
    })

    profileCache.set(userId, { data: result, timestamp: Date.now() })
    return result
  } catch (err) {
    console.error('[Auth] Robust Role/Subscription fetch error:', err)
    return { role: 'user', hasActiveSubscription: false, subStatusReason: 'Fetch Error' }
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
              subStatusReason: profile.subStatusReason
            }
            localStorage.setItem('auth_user', JSON.stringify(updatedUser))
            setUser(updatedUser)
            console.log('[Auth] ✅ Updated user role and subscription from database')
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
            console.log('[Auth] Found Supabase session, fetching user role...')

            // Fetch role and subscription in parallel with session
            const [profileResult] = await Promise.allSettled([
              fetchUserRoleAndSubscription(session.user.id)
            ])

            let role: 'user' | 'admin' = 'user'
            let hasActiveSubscription = false
            let subStatusReason = 'PENDING'

            if (profileResult.status === 'fulfilled') {
              role = profileResult.value.role as 'user' | 'admin'
              hasActiveSubscription = profileResult.value.hasActiveSubscription || false
              subStatusReason = profileResult.value.subStatusReason
              console.log('[Auth] User profile fetched in parallel:', { role, hasActiveSubscription, subStatusReason })
            } else {
              console.warn('[Auth] Profile fetch failed, using defaults')
              subStatusReason = 'Profile fetch failed'
            }

            const user = {
              ...session.user,
              role,
              hasActiveSubscription,
              subStatusReason
            } as User
            localStorage.setItem('access_token', session.access_token)
            localStorage.setItem('auth_user', JSON.stringify(user))
            setUser(user)
          } else {
            console.log('[Auth] No session found')
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
      console.log('[Auth] Auth state change event:', event, session?.user?.id)

      if (mounted) {
        if (session?.user) {
          // Fetch role and subscription in parallel for faster auth state changes
          const [profileResult] = await Promise.allSettled([
            fetchUserRoleAndSubscription(session.user.id)
          ])

          let role: 'user' | 'admin' = 'user'
          let hasActiveSubscription = false
          let subStatusReason = 'PENDING'

          if (profileResult.status === 'fulfilled') {
            role = profileResult.value.role as 'user' | 'admin'
            hasActiveSubscription = profileResult.value.hasActiveSubscription || false
            subStatusReason = profileResult.value.subStatusReason
            console.log('[Auth] User profile fetched on state change:', { role, hasActiveSubscription, subStatusReason })
          } else {
            console.warn('[Auth] Profile fetch failed on state change, using defaults')
            subStatusReason = 'Profile fetch failed'
          }

          const user = {
            ...session.user,
            role,
            hasActiveSubscription,
            subStatusReason
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
      if (timeoutId) clearTimeout(timeoutId)
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

      // Use a shorter timeout for login specifically (5 seconds)
      const { data } = await api.post('/api/auth/login', { email, password }, { timeout: 5000 })
      console.log('[Auth] Login response received:', { hasToken: !!data.access_token, hasUser: !!data.user })

      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)

        // Set user immediately with basic data, fetch role in background
        let userWithRole = {
          ...data.user,
          role: 'user' as const,
          hasActiveSubscription: false,
          subStatusReason: 'Checking status...'
        }
        setUser(userWithRole)
        localStorage.setItem('auth_user', JSON.stringify(userWithRole))

        // Fetch role in background (non-blocking)
        fetchUserRoleAndSubscription(data.user.id).then(profile => {
          const updatedUser = {
            ...data.user,
            role: profile.role as 'user' | 'admin',
            hasActiveSubscription: profile.hasActiveSubscription || false,
            subStatusReason: profile.subStatusReason
          }
          localStorage.setItem('auth_user', JSON.stringify(updatedUser))
          setUser(updatedUser)
          console.log('[Auth] ✅ Background role fetch complete:', profile.role)
        }).catch(err => {
          console.warn('[Auth] Background role fetch failed, using default:', err)
        })

        console.log('[Auth] Login complete, user set with defaults')

        // Log before setting session
        console.log('[Auth] Setting Supabase session...')

        // Set session in Supabase client with shorter timeout (non-blocking)
        try {
          const sessionPromise = supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || data.access_token,
          })

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase session set timeout')), 3000)
          )

          // Fire and forget - don't block login on session set
          Promise.race([sessionPromise, timeoutPromise])
            .then((result: any) => {
              if (result?.error) console.error('[Auth] Failed to set Supabase session:', result.error)
              else console.log('[Auth] Supabase session set successfully')
            })
            .catch(err => {
              console.warn('[Auth] Supabase session set warning:', err)
            })

          console.log('[Auth] Session setup initiated, login complete')

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
    console.log('[Auth] Starting sign out...')

    // Clear cache on sign out
    if (user?.id) {
      profileCache.delete(user.id)
    }

    // Step 1: Clear our state immediately
    setUser(null)

    // Step 2: Clear our auth storage
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')

    // Step 3: Clear Supabase storage by collecting keys first (to avoid length issues)
    const sessionKeys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i) || '')
      .filter(key => key && (key.startsWith('sb-') || key === 'supabase.auth.token'))
    sessionKeys.forEach(key => sessionStorage.removeItem(key))

    const localStorageKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || '')
      .filter(key => key && (key.startsWith('sb-') || key === 'supabase.auth.token'))
    localStorageKeys.forEach(key => localStorage.removeItem(key))

    // Step 4: Sign out from Supabase (non-blocking)
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('[Auth] Supabase sign out warning:', error)
    }

    // Step 5: Call logout API (non-blocking)
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      console.warn('[Auth] Logout API warning:', error)
    }

    console.log('[Auth] Sign out complete')
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

  const refreshSubscriptionStatus = async () => {
    if (!user?.id) {
      console.warn('[Auth] Cannot refresh subscription status: no user ID')
      return { hasActiveSubscription: false, role: 'user' }
    }

    console.log('[Auth] Refreshing subscription status for user:', user.id)

    try {
      // Force refresh subscription status
      const profile = await fetchUserRoleAndSubscription(user.id, true)

      const hasActive = profile.hasActiveSubscription || false
      const role = profile.role as 'user' | 'admin'

      const updatedUser = {
        ...user,
        role: role,
        hasActiveSubscription: hasActive,
        subStatusReason: profile.subStatusReason
      }

      localStorage.setItem('auth_user', JSON.stringify(updatedUser))
      setUser(updatedUser as User)

      console.log('[Auth] ✅ Subscription status refreshed (force):', {
        role: role,
        hasActiveSubscription: hasActive,
        subStatusReason: profile.subStatusReason
      })

      return { hasActiveSubscription: hasActive, role: role }
    } catch (error) {
      console.error('[Auth] Failed to refresh subscription status:', error)
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
