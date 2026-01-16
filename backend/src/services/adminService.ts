import { supabase } from '../lib/supabase.js'

export interface DashboardStats {
    users: {
        total: number
        new: number
        active: number
    }
    subscriptions: {
        total: number
        byPlan: Record<string, number>
        revenue: number
    }
    videos: {
        total: number
        new: number
        processing: number
    }
    credits: {
        totalSpent: number
        totalPurchased: number
    }
    timestamp: string
}

interface SubscriptionData {
    plan_id: string
    status: string
    price_paid: number
}

export class AdminService {
    /**
     * Get dashboard statistics for a given time range
     */
    static async getDashboardStats(range: string): Promise<DashboardStats> {
        console.log('[Admin] Fetching dashboard stats for range:', range)

        const now = new Date()
        let startDate: Date | null = null

        switch (range) {
            case '1h':
                startDate = new Date(now.getTime() - 60 * 60 * 1000)
                break
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                break
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case '1m':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                break
            case '1y':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
                break
            case 'lifetime':
            default:
                startDate = null
                break
        }

        const startISO = startDate?.toISOString()

        // 1. Users stats
        const { count: totalUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })

        const { count: newUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startISO || '1970-01-01')

        // 2. Subscriptions stats
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, price_paid')
            .eq('status', 'active')

        const byPlan: Record<string, number> = {}
        let revenue = 0
        if (subs) {
            (subs as any[]).forEach((s: SubscriptionData) => {
                byPlan[s.plan_id] = (byPlan[s.plan_id] || 0) + 1
                revenue += (s.price_paid || 0)
            })
        }

        // 3. Videos stats
        const { count: totalVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })

        const { count: newVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startISO || '1970-01-01')

        const { count: processingVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .in('status', ['pending', 'processing', 'generating'])

        // 4. Credits stats
        const creditsQuery = supabase
            .from('credit_transactions')
            .select('amount, type')

        if (startISO) {
            creditsQuery.gte('created_at', startISO)
        }
        const { data: transactions } = await creditsQuery

        let totalSpent = 0
        let totalPurchased = 0

        if (transactions) {
            transactions.forEach((t: any) => {
                const amount = Math.abs(t.amount)
                if (t.type === 'usage' || (t.type === 'adjustment' && t.amount < 0)) {
                    totalSpent += amount
                } else if (t.type === 'topup' || t.type === 'subscription' || (t.type === 'adjustment' && t.amount > 0)) {
                    totalPurchased += amount
                }
            })
        }

        return {
            users: {
                total: totalUsers || 0,
                new: newUsers || 0,
                active: totalUsers || 0 // Simplified for now
            },
            subscriptions: {
                total: subs?.length || 0,
                byPlan,
                revenue
            },
            videos: {
                total: totalVideos || 0,
                new: newVideos || 0,
                processing: processingVideos || 0
            },
            credits: {
                totalSpent,
                totalPurchased
            },
            timestamp: now.toISOString()
        }
    }
}
