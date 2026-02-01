import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

interface Subscription {
    id: string
    plan_id: string
    plan_name: string
    status: string
    credits_remaining: number
    credits_included: number
    expires_at: string | null
}

interface CreditContextType {
    credits: number | null
    unlimited: boolean
    subscription: Subscription | null
    loading: boolean
    refreshCredits: () => Promise<void>
}

const CreditContext = createContext<CreditContextType | undefined>(undefined)

export function CreditProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [credits, setCredits] = useState<number | null>(null)
    const [unlimited, setUnlimited] = useState(false)
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [loading, setLoading] = useState(true)

    const lastFetchRef = (import.meta as any).lastCreditsFetchRef || { current: 0 }
    if (!(import.meta as any).lastCreditsFetchRef) (import.meta as any).lastCreditsFetchRef = lastFetchRef

    const pendingFetchRef = (import.meta as any).pendingCreditsFetchRef || { current: null }
    if (!(import.meta as any).pendingCreditsFetchRef) (import.meta as any).pendingCreditsFetchRef = pendingFetchRef

    const fetchCredits = useCallback(async (force = false) => {
        if (!user) {
            setCredits(null)
            setUnlimited(false)
            setSubscription(null)
            setLoading(false)
            return
        }

        const now = Date.now()
        // Deduplicate: if a fetch is already in progress, return it
        if (pendingFetchRef.current) {
            return pendingFetchRef.current
        }

        // Throttling: if we fetched very recently, skip unless forced
        if (!force && (now - lastFetchRef.current < 5000)) {
            return
        }

        pendingFetchRef.current = (async () => {
            try {
                console.log(`[Credits] Fetching credits for ${user.email}...`)
                const response = await api.get('/api/credits')
                const newCredits = response.data.credits ?? 0
                const newUnlimited = response.data.unlimited === true || response.data.credits === null

                setCredits(newCredits)
                setUnlimited(newUnlimited)
                setSubscription(response.data.subscription)
                lastFetchRef.current = Date.now()
            } catch (error) {
                console.error('Failed to fetch credits:', error)
            } finally {
                setLoading(false)
                pendingFetchRef.current = null
            }
        })()

        return pendingFetchRef.current
    }, [user])

    useEffect(() => {
        fetchCredits()

        // Refresh credits every 30 seconds if user is logged in
        let interval: NodeJS.Timeout | null = null
        if (user) {
            interval = setInterval(() => fetchCredits(), 30000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [user, fetchCredits])

    return (
        <CreditContext.Provider value={{ credits, unlimited, subscription, loading, refreshCredits: fetchCredits }}>
            {children}
        </CreditContext.Provider>
    )
}

export function useCreditsContext() {
    const context = useContext(CreditContext)
    if (context === undefined) {
        throw new Error('useCreditsContext must be used within a CreditProvider')
    }
    return context
}
