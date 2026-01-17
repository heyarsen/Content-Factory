import React, { useEffect, useState } from 'react'
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
  }
  subscriptions: {
    total: number
    byPlan: Record<string, number>
    revenue: number
    churnRate: number
    mrr: number
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

  return (
    <Layout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Administration</p>
            <h1 className="text-3xl font-semibold text-primary">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Monitor platform activity and oversee system operations.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-2">
              <Shield className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold text-brand-600">Administrator</span>
            </div>
            <select
              value={range}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRange(e.target.value)}
              className="rounded-xl border-slate-200 bg-white text-sm focus:ring-brand-500 py-2 pl-3 pr-8"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="1m">Last Month</option>
              <option value="1y">Last Year</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {/* Users Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Users</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.users.total || 0}</p>
                  {stats?.users.new !== undefined && stats.users.new > 0 && (
                    <span className="text-xs font-medium text-green-600 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{stats.users.new}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Verified</span>
                    <span className="font-medium">{stats?.users.verified || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Admins</span>
                    <span className="font-medium text-brand-600">{stats?.users.adminCount || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* Subscriptions Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Subscriptions</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.subscriptions.total || 0}</p>
                  <span className="text-xs font-medium text-brand-600">${stats?.subscriptions.revenue.toFixed(2)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">MRR</span>
                    <span className="font-medium">${stats?.subscriptions.mrr.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Churn</span>
                    <span className={`font-medium ${(stats?.subscriptions.churnRate || 0) > 5 ? 'text-rose-600' : 'text-green-600'}`}>
                      {(stats?.subscriptions.churnRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* Videos Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-purple-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Video Processing</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.videos.total || 0}</p>
                  {stats?.videos.processing ? (
                    <span className="text-xs font-medium text-amber-600 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {stats.videos.processing}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Completed</span>
                    <span className="font-medium text-green-600 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {stats?.videos.completed || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Failed</span>
                    <span className="font-medium text-rose-600 flex items-center">
                      <XCircle className="h-3 w-3 mr-1" />
                      {stats?.videos.failed || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          {/* System Health Card */}
          <Card className="relative overflow-hidden">
            <div className={`absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl ${
              stats?.system.health === 'healthy' ? 'bg-emerald-100/60' :
              stats?.system.health === 'warning' ? 'bg-amber-100/60' : 'bg-rose-100/60'
            }`} />
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">System Health</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats?.system.health === 'healthy' ? 'bg-emerald-100 text-emerald-800' :
                    stats?.system.health === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {stats?.system.health === 'healthy' && <Activity className="h-3 w-3 mr-1" />}
                    {stats?.system.health === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {stats?.system.health === 'critical' && <XCircle className="h-3 w-3 mr-1" />}
                    {stats?.system.health || 'unknown'}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Uptime</span>
                    <span className="font-medium">{stats?.system.uptime.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Error Rate</span>
                    <span className={`font-medium ${(stats?.system.errorRate || 0) > 5 ? 'text-rose-600' : 'text-green-600'}`}>
                      {(stats?.system.errorRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                stats?.system.health === 'healthy' ? 'bg-emerald-50 text-emerald-600' :
                stats?.system.health === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
              }`}>
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {/* Credits Overview */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Credits Overview</h3>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{stats?.credits.totalPurchased || 0}</p>
                <p className="text-xs text-slate-500">Total Purchased</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{stats?.credits.totalSpent || 0}</p>
                <p className="text-xs text-slate-500">Total Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats?.credits.currentBalance || 0}</p>
                <p className="text-xs text-slate-500">Current Balance</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Burn Rate</span>
                <span className="font-medium">{stats?.credits.burnRate.toFixed(1)}%</span>
              </div>
            </div>
          </Card>

          {/* Video Processing Stats */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Video Processing</h3>
              <Video className="h-5 w-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{stats?.videos.new || 0}</p>
                <p className="text-xs text-slate-500">New Videos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats?.videos.avgProcessingTime.toFixed(1)}m</p>
                <p className="text-xs text-slate-500">Avg Processing Time</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">Success Rate</span>
                <span className="font-medium text-green-600">
                  {stats?.videos.total ? ((stats.videos.completed / stats.videos.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats?.videos.total ? ((stats.videos.completed / stats.videos.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Users Management */}
        <Card>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-primary">User Management</h2>
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

