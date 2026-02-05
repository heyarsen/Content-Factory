import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import {
  Users,
  Video,
  Shield,
  ShieldCheck,
  BarChart3,
  UserPlus,
  UserMinus,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Activity,
  Search
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface AdminStats {
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
    mrr: number
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

interface User {
  id: string
  email: string
  createdAt: string
  lastSignIn: string | null
  emailConfirmed: boolean
  roles: string[]
}

export function AdminPanel() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('24h')
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionModal, setActionModal] = useState<{
    type: 'assign' | 'remove'
    userId: string
    email: string
  } | null>(null)
  const [processing, setProcessing] = useState(false)
  const cutoffLabel = 'Feb 5, 2026'

  const rangeOptions = [
    { value: '1h', label: '1H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: '1m', label: '1M' },
    { value: '1y', label: '1Y' },
    { value: 'lifetime', label: 'All' }
  ]

  useEffect(() => {
    loadStats()
    loadUsers()
  }, [range])

  useEffect(() => {
    if (currentPage === 1) {
      loadUsers()
    }
  }, [currentPage, searchTerm])

  useEffect(() => {
    if (currentPage > 1) {
      loadUsers()
    }
  }, [currentPage])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/admin/stats?range=${range}`)
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await api.get('/api/admin/users', {
        params: {
          page: currentPage,
          limit: 50,
          search: searchTerm
        }
      })
      setUsers(response.data.users || [])
      setTotalPages(response.data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const handleAssignAdmin = async () => {
    if (!actionModal) return
    setProcessing(true)
    try {
      await api.post(`/api/admin/users/${actionModal.userId}/assign-admin`)
      await loadUsers()
      setActionModal(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign admin role')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveAdmin = async () => {
    if (!actionModal) return
    setProcessing(true)
    try {
      await api.post(`/api/admin/users/${actionModal.userId}/remove-admin`)
      await loadUsers()
      setActionModal(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove admin role')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-32 rounded-[28px]" />
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  const growth = stats?.users.growth ?? []

  return (
    <Layout>
      <div className="space-y-12">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_55%)]" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Admin Command Center</p>
              <h1 className="text-3xl font-semibold lg:text-4xl">Admin Dashboard</h1>
              <p className="max-w-xl text-sm text-white/70">
                Get a comprehensive view of subscribers, user activity, revenue health, and system stability across the time
                range you select. Data is scoped to activity on or after {cutoffLabel}.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2">
                  <Shield className="h-5 w-5 text-white" />
                  <span className="text-sm font-semibold text-white">Administrator</span>
                </div>
                <div className="text-xs text-white/60">Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Just now'}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                    range === option.value ? 'bg-white text-slate-900' : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-emerald-100/80 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Active Users</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-primary">{stats?.users.active || 0}</p>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    +{stats?.users.new || 0} new
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Verified: {stats?.users.verified || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-indigo-100/70 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">New Subscribers</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-primary">{stats?.subscriptions.new || 0}</p>
                  <span className="text-xs font-semibold text-indigo-600 flex items-center">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {stats?.subscriptions.total || 0} active
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">MRR: ${(stats?.subscriptions.mrr ?? 0).toFixed(2)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-amber-100/70 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Active Subscriptions</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-primary">{stats?.subscriptions.total || 0}</p>
                  <span className="text-xs font-semibold text-amber-600 flex items-center">
                    <ArrowDownRight className="mr-1 h-3 w-3" />
                    {(stats?.subscriptions.churnRate ?? 0).toFixed(1)}% churn
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Revenue: ${(stats?.subscriptions.revenue ?? 0).toFixed(2)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Layers className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-purple-100/70 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Video Throughput</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-primary">{stats?.videos.total || 0}</p>
                  <span className="text-xs font-semibold text-purple-600 flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    {stats?.videos.processing || 0} in queue
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Avg time: {(stats?.videos.avgProcessingTime ?? 0).toFixed(1)}m</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-rose-100/70 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">System Health</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                    stats?.system.health === 'healthy'
                      ? 'bg-emerald-100 text-emerald-700'
                      : stats?.system.health === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}>
                    {stats?.system.health === 'healthy' && <Activity className="mr-1 h-3 w-3" />}
                    {stats?.system.health === 'warning' && <AlertTriangle className="mr-1 h-3 w-3" />}
                    {stats?.system.health === 'critical' && <XCircle className="mr-1 h-3 w-3" />}
                    {stats?.system.health || 'unknown'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Uptime {(stats?.system.uptime ?? 0).toFixed(1)}% · Errors {(stats?.system.errorRate ?? 0).toFixed(1)}%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-10 rounded-full bg-sky-100/70 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Credits Health</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-primary">{stats?.credits.currentBalance || 0}</p>
                  <span className="text-xs font-semibold text-sky-600 flex items-center">
                    <BarChart3 className="mr-1 h-3 w-3" />
                    {(stats?.credits.burnRate ?? 0).toFixed(1)}% burn
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Purchased {stats?.credits.totalPurchased || 0} · Spent {stats?.credits.totalSpent || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">New User Growth</h2>
                <p className="text-xs text-slate-500">New signups over the selected range.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6">
              <div className="flex h-20 items-end gap-1">
                {growth.map((point, index) => {
                  const max = Math.max(...growth.map((p) => p.newUsers), 1)
                  const height = Math.round((point.newUsers / max) * 100)
                  return (
                    <div
                      key={`${point.label}-${index}`}
                      className="flex-1 rounded-full bg-emerald-200/80"
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${point.newUsers} new`}
                    />
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{growth[0]?.label}</span>
                <span>{growth[growth.length - 1]?.label}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>Total new users</span>
                <span className="font-semibold text-primary">{stats?.users.new || 0}</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">Active User Growth</h2>
                <p className="text-xs text-slate-500">Users signing in within the range.</p>
              </div>
              <Activity className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6">
              <div className="flex h-20 items-end gap-1">
                {growth.map((point, index) => {
                  const max = Math.max(...growth.map((p) => p.activeUsers), 1)
                  const height = Math.round((point.activeUsers / max) * 100)
                  return (
                    <div
                      key={`${point.label}-${index}`}
                      className="flex-1 rounded-full bg-sky-200/80"
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${point.activeUsers} active`}
                    />
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{growth[0]?.label}</span>
                <span>{growth[growth.length - 1]?.label}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>Active users</span>
                <span className="font-semibold text-primary">{stats?.users.active || 0}</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">Subscriber Mix</h2>
                <p className="text-xs text-slate-500">Distribution by plan for the selected range.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6 space-y-4">
              {Object.entries(stats?.subscriptions.byPlan || {}).map(([plan, count]) => {
                const total = stats?.subscriptions.total || 1
                const share = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={plan} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{plan}</span>
                      <span className="text-slate-500">{count} · {share}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {!Object.keys(stats?.subscriptions.byPlan || {}).length && (
                <p className="text-sm text-slate-400">No plan distribution data available.</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">User Activity</h2>
                <p className="text-xs text-slate-500">Active, verified, and newly acquired users.</p>
              </div>
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6 space-y-4">
              {[
                { label: 'Active users', value: stats?.users.active || 0, color: 'bg-emerald-500' },
                { label: 'Verified users', value: stats?.users.verified || 0, color: 'bg-blue-500' },
                { label: 'New users', value: stats?.users.new || 0, color: 'bg-purple-500' }
              ].map((item) => {
                const total = Math.max(stats?.users.total || 0, 1)
                const percent = Math.min(100, Math.round((item.value / total) * 100))
                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="text-slate-500">{item.value} · {percent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">Video Pipeline</h2>
                <p className="text-xs text-slate-500">Production status for the selected range.</p>
              </div>
              <Video className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Completed', value: stats?.videos.completed || 0, icon: CheckCircle, tone: 'text-emerald-600' },
                { label: 'Processing', value: stats?.videos.processing || 0, icon: Clock, tone: 'text-amber-600' },
                { label: 'Failed', value: stats?.videos.failed || 0, icon: XCircle, tone: 'text-rose-600' }
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                    <Icon className={`h-4 w-4 ${tone}`} />
                    {label}
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-primary">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Success rate</span>
                <span className="font-medium text-emerald-600">
                  {stats?.videos.total ? ((stats.videos.completed / stats.videos.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${stats?.videos.total ? ((stats.videos.completed / stats.videos.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">System Pulse</h2>
                <p className="text-xs text-slate-500">API response time and stability.</p>
              </div>
              <Activity className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Avg Response Time</p>
                <p className="mt-2 text-2xl font-semibold text-primary">{(stats?.system.avgResponseTime ?? 0).toFixed(0)} ms</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Error Rate</p>
                <p className={`mt-2 text-2xl font-semibold ${
                  (stats?.system.errorRate || 0) > 5 ? 'text-rose-600' : 'text-emerald-600'
                }`}>{(stats?.system.errorRate ?? 0).toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Uptime</p>
                <p className="mt-2 text-2xl font-semibold text-primary">{(stats?.system.uptime ?? 0).toFixed(1)}%</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Users Management */}
        <Card>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">User Management</h2>
              <p className="text-xs text-slate-500">Showing users created on or after {cutoffLabel}.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={loadUsers} disabled={usersLoading}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {users.map((u: User) => {
                  const isAdmin = u.roles.includes('admin')
                  const isCurrentUser = u.id === user?.id

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-semibold text-primary">{u.email}</p>
                          {isAdmin && (
                            <Badge variant="success">
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          {isCurrentUser && (
                            <Badge variant="info">You</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                          <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                          {u.lastSignIn && (
                            <span>Last sign in: {new Date(u.lastSignIn).toLocaleDateString()}</span>
                          )}
                          {u.emailConfirmed ? (
                            <Badge variant="success">Verified</Badge>
                          ) : (
                            <Badge variant="warning">Unverified</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isCurrentUser && (
                          <>
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="border border-rose-100 bg-rose-50/70 text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                                onClick={() => setActionModal({ type: 'remove', userId: u.id, email: u.email })}
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Remove Admin
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="border border-brand-100 bg-brand-50/70 text-brand-600 hover:border-brand-200 hover:bg-brand-50"
                                onClick={() => setActionModal({ type: 'assign', userId: u.id, email: u.email })}
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Make Admin
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              page === currentPage
                                ? 'bg-brand-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Action Modal */}
        <Modal
          isOpen={actionModal !== null}
          onClose={() => setActionModal(null)}
          title={actionModal?.type === 'assign' ? 'Assign Admin Role' : 'Remove Admin Role'}
          size="sm"
        >
          {actionModal && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {actionModal.type === 'assign'
                  ? `Are you sure you want to make ${actionModal.email} an administrator? They will have full access to the admin panel and user management.`
                  : `Are you sure you want to remove admin privileges from ${actionModal.email}? They will lose access to the admin panel.`}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setActionModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant={actionModal.type === 'assign' ? 'primary' : 'danger'}
                  onClick={actionModal.type === 'assign' ? handleAssignAdmin : handleRemoveAdmin}
                  loading={processing}
                >
                  {actionModal.type === 'assign' ? 'Assign Admin' : 'Remove Admin'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}
