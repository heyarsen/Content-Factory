import { supabase } from '../lib/supabase.js'

export interface DashboardStats {
    users: {
        total: number
        new: number
    }
    videos: {
        total: number
        new: number
    }
    credits: {
        totalSpent: number
        totalPurchased: number
    }
    timestamp: string
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

        // 1. Users count
        const { count: totalUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })

        const usersQuery = supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })

        if (startISO) {
            usersQuery.gte('created_at', startISO)
        }
        const { count: newUsers } = await usersQuery

        // 2. Videos count (reels)
        const { count: totalVideos } = await supabase
            .from('reels')
            .select('*', { count: 'exact', head: true })

        const videosQuery = supabase
            .from('reels')
            .select('*', { count: 'exact', head: true })

        if (startISO) {
            videosQuery.gte('created_at', startISO)
        }
        const { count: newVideos } = await videosQuery

        // 3. Credits stats
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
                if (t.type === 'usage' || (t.type === 'adjustment' && t.amount < 0)) {
                    totalSpent += Math.abs(t.amount)
                } else if (t.type === 'topup' || t.type === 'subscription' || (t.type === 'adjustment' && t.amount > 0)) {
                    totalPurchased += t.amount
                }
            })
        }

        return {
            users: {
                total: totalUsers || 0,
                new: newUsers || 0
            },
            videos: {
                total: totalVideos || 0,
                new: newVideos || 0
            },
            credits: {
                totalSpent,
                totalPurchased
            },
            timestamp: now.toISOString()
        }
    }
}
