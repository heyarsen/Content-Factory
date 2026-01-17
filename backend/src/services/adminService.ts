import { supabase } from '../lib/supabase.js'

export interface DashboardStats {
    users: {
        total: number
        new: number
        active: number
        verified: number
        adminCount: number
    }
    subscriptions: {
        total: number
        byPlan: Record<string, number>
        revenue: number
        churnRate: number
        mrr: number // Monthly recurring revenue
    }
    videos: {
        total: number
        new: number
        processing: number
        completed: number
        failed: number
        avgProcessingTime: number
    }
    credits: {
        totalSpent: number
        totalPurchased: number
        currentBalance: number
        burnRate: number
    }
    system: {
        health: 'healthy' | 'warning' | 'critical'
        errorRate: number
        avgResponseTime: number
        uptime: number
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

        const { count: verifiedUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .not('email_confirmed_at', 'is', null)

        const { count: adminUsers } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin')

        // 2. Subscriptions stats
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, price_paid, created_at')
            .eq('status', 'active')

        const { data: allSubs } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, price_paid, created_at')

        const byPlan: Record<string, number> = {}
        let revenue = 0
        let mrr = 0
        
        if (subs) {
            (subs as any[]).forEach((s: SubscriptionData) => {
                byPlan[s.plan_id] = (byPlan[s.plan_id] || 0) + 1
                revenue += (s.price_paid || 0)
                mrr += (s.price_paid || 0) // Assuming monthly plans
            })
        }

        // Calculate churn rate
        const totalSubscriptions = allSubs?.length || 0
        const cancelledSubscriptions = allSubs?.filter((s: any) => s.status === 'cancelled').length || 0
        const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0

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

        const { count: completedVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')

        const { count: failedVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'failed')

        // Calculate average processing time (simplified)
        const { data: processedVideos } = await supabase
            .from('videos')
            .select('created_at, updated_at')
            .eq('status', 'completed')
            .limit(100)

        let avgProcessingTime = 0
        if (processedVideos && processedVideos.length > 0) {
            const totalTime = processedVideos.reduce((sum: number, video: any) => {
                const created = new Date(video.created_at).getTime()
                const updated = new Date(video.updated_at).getTime()
                return sum + (updated - created)
            }, 0)
            avgProcessingTime = totalTime / processedVideos.length / 1000 / 60 // Convert to minutes
        }

        // 4. Credits stats
        const creditsQuery = supabase
            .from('credit_transactions')
            .select('amount, type')

        if (startISO) {
            creditsQuery.gte('created_at', startISO)
        }
        const { data: transactions } = await creditsQuery

        // Get current credit balances
        const { data: creditBalances } = await supabase
            .from('user_credits')
            .select('balance')

        let totalSpent = 0
        let totalPurchased = 0
        let currentBalance = 0

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

        if (creditBalances) {
            currentBalance = creditBalances.reduce((sum: number, cb: any) => sum + (cb.balance || 0), 0)
        }

        const burnRate = totalSpent > 0 ? totalSpent / (totalPurchased || 1) * 100 : 0

        // 5. System health (simplified)
        const errorRate = failedVideos && totalVideos ? (failedVideos / totalVideos) * 100 : 0
        const health = errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy'

        return {
            users: {
                total: totalUsers || 0,
                new: newUsers || 0,
                active: totalUsers || 0, // Simplified for now
                verified: verifiedUsers || 0,
                adminCount: adminUsers || 0
            },
            subscriptions: {
                total: subs?.length || 0,
                byPlan,
                revenue,
                churnRate,
                mrr
            },
            videos: {
                total: totalVideos || 0,
                new: newVideos || 0,
                processing: processingVideos || 0,
                completed: completedVideos || 0,
                failed: failedVideos || 0,
                avgProcessingTime
            },
            credits: {
                totalSpent,
                totalPurchased,
                currentBalance,
                burnRate
            },
            system: {
                health,
                errorRate,
                avgResponseTime: 0, // Placeholder - would need monitoring setup
                uptime: 99.9 // Placeholder - would need monitoring setup
            },
            timestamp: now.toISOString()
        }
    }
}
