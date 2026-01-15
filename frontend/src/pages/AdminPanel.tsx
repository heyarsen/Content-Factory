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
  UserMinus
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface AdminStats {
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
      const response = await api.get('/api/admin/users')
      setUsers(response.data.users || [])
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

        {/* Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Clients</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.users.total || 0}</p>
                  {stats?.users.new !== undefined && stats.users.new > 0 && (
                    <span className="text-xs font-medium text-green-600">+{stats.users.new} new</span>
                  )}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Subscriptions</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.subscriptions.total || 0}</p>
                  <span className="text-xs font-medium text-brand-600">${stats?.subscriptions.revenue.toFixed(2)} rev.</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-purple-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Videos</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold text-primary">{stats?.videos.total || 0}</p>
                  {stats?.videos.processing ? (
                    <span className="text-xs font-medium text-amber-600">{stats.videos.processing} processing</span>
                  ) : stats?.videos.new ? (
                    <span className="text-xs font-medium text-green-600">+{stats.videos.new} new</span>
                  ) : null}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Credits Usage</p>
                <div className="mt-3">
                  <p className="text-4xl font-semibold text-primary">{stats?.credits.totalPurchased || 0}</p>
                  <p className="text-[10px] font-medium text-slate-400">Spent: {stats?.credits.totalSpent || 0}</p>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Users Management */}
        <Card>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">User Management</h2>
            <Button variant="ghost" size="sm" onClick={loadUsers} disabled={usersLoading}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
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

