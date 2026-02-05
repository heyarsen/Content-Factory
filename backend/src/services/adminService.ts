import { supabase } from '../lib/supabase.js'

export interface DashboardStats {
    users: {
        total: number
        new: number
        active: number
        verified: number
        adminCount: number
        growth: Array<{
            label: string
            newUsers: number
            activeUsers: number
        }>
    }
    subscriptions: {
        total: number
        byPlan: Record<string, number>
        revenue: number
        churnRate: number
        mrr: number // Monthly recurring revenue
        new: number
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
    static readonly DASHBOARD_CUTOFF = new Date('2026-02-05T00:00:00.000Z')

    private static buildUserGrowthBuckets(range: string, now: Date, cutoff: Date) {
        const labels: string[] = []
        const starts: Date[] = []
        const ends: Date[] = []

        if (['1y', 'lifetime'].includes(range)) {
            const endMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1)
            let cursor = startMonth < cutoff ? new Date(cutoff.getFullYear(), cutoff.getMonth(), 1) : startMonth

            while (cursor <= endMonth) {
                const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
                starts.push(new Date(cursor))
                ends.push(new Date(next))
                labels.push(cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' }))
                cursor = next
            }

            return { starts, ends, labels }
        }

        let stepMs = 24 * 60 * 60 * 1000
        let count = 7

        switch (range) {
            case '1h':
                stepMs = 10 * 60 * 1000
                count = 6
                break
            case '24h':
                stepMs = 60 * 60 * 1000
                count = 24
                break
            case '7d':
                stepMs = 24 * 60 * 60 * 1000
                count = 7
                break
            case '1m':
                stepMs = 24 * 60 * 60 * 1000
                count = 30
                break
            default:
                break
        }

        const end = now
        let start = new Date(end.getTime() - stepMs * (count - 1))
        if (start < cutoff) {
            start = new Date(cutoff)
        }

        for (let i = 0; i < count; i += 1) {
            const bucketStart = new Date(start.getTime() + stepMs * i)
            const bucketEnd = new Date(bucketStart.getTime() + stepMs)
            if (bucketStart > end) {
                break
            }
            starts.push(bucketStart)
            ends.push(bucketEnd)
            labels.push(bucketStart.toLocaleString('en-US', {
                month: 'short',
                day: stepMs >= 24 * 60 * 60 * 1000 ? '2-digit' : undefined,
                hour: stepMs < 24 * 60 * 60 * 1000 ? '2-digit' : undefined,
                minute: stepMs < 60 * 60 * 1000 ? '2-digit' : undefined
            }))
        }

        return { starts, ends, labels }
    }

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

        const cutoffDate = AdminService.DASHBOARD_CUTOFF
        const effectiveStart = startDate && startDate > cutoffDate ? startDate : cutoffDate
        const startISO = effectiveStart.toISOString()

        // 1. Users stats
        const { count: totalUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', cutoffDate.toISOString())

        const { count: newUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startISO)

        const { count: verifiedUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .not('email_confirmed_at', 'is', null)
            .gte('created_at', cutoffDate.toISOString())

        const { count: activeUsers } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', cutoffDate.toISOString())
            .gte('last_sign_in_at', startISO)

        const { count: adminUsers } = await supabase
            .from('user_profiles')
            .select('id, user_roles!inner(role)', { count: 'exact', head: true })
            .eq('user_roles.role', 'admin')
            .gte('created_at', cutoffDate.toISOString())

        // 2. Subscriptions stats
        const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, price_paid, created_at')
            .eq('status', 'active')
            .gte('created_at', cutoffDate.toISOString())

        const { data: allSubs } = await supabase
            .from('user_subscriptions')
            .select('plan_id, status, price_paid, created_at')
            .gte('created_at', cutoffDate.toISOString())

        const { count: newSubs } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startISO)

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
            .gte('created_at', cutoffDate.toISOString())

        const { count: newVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startISO)

        const { count: processingVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .in('status', ['pending', 'processing', 'generating'])
            .gte('created_at', cutoffDate.toISOString())

        const { count: completedVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('created_at', cutoffDate.toISOString())

        const { count: failedVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'failed')
            .gte('created_at', cutoffDate.toISOString())

        // Calculate average processing time (simplified)
        const { data: processedVideos } = await supabase
            .from('videos')
            .select('created_at, updated_at')
            .eq('status', 'completed')
            .gte('created_at', cutoffDate.toISOString())
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

        creditsQuery.gte('created_at', startISO)
        const { data: transactions } = await creditsQuery

        // Get current credit balances
        const { data: creditBalances } = await supabase
            .from('user_credits')
            .select('balance, user_profiles!inner(created_at)')
            .gte('user_profiles.created_at', cutoffDate.toISOString())

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

        const growthBuckets = AdminService.buildUserGrowthBuckets(range, now, cutoffDate)
        const { data: userActivity } = await supabase
            .from('user_profiles')
            .select('created_at, last_sign_in_at')
            .gte('created_at', cutoffDate.toISOString())

        const growth = growthBuckets.labels.map((label, index) => {
            const start = growthBuckets.starts[index]
            const end = growthBuckets.ends[index]
            const newUsersCount = userActivity?.filter((u: any) => {
                const createdAt = new Date(u.created_at)
                return createdAt >= start && createdAt < end
            }).length || 0
            const activeUsersCount = userActivity?.filter((u: any) => {
                if (!u.last_sign_in_at) return false
                const lastSignIn = new Date(u.last_sign_in_at)
                return lastSignIn >= start && lastSignIn < end
            }).length || 0

            return {
                label,
                newUsers: newUsersCount,
                activeUsers: activeUsersCount
            }
        })

        return {
            users: {
                total: totalUsers || 0,
                new: newUsers || 0,
                active: activeUsers || 0,
                verified: verifiedUsers || 0,
                adminCount: adminUsers || 0,
                growth
            },
            subscriptions: {
                total: subs?.length || 0,
                byPlan,
                revenue,
                churnRate,
                mrr,
                new: newSubs || 0
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
