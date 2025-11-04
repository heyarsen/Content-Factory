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
  Share2, 
  Calendar, 
  Shield, 
  ShieldCheck, 
  TrendingUp,
  BarChart3,
  UserPlus,
  UserMinus
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface AdminStats {
  users: {
    total: number
  }
  videos: {
    total: number
    byStatus: Record<string, number>
  }
  socialAccounts: {
    total: number
    byPlatform: Record<string, { total: number; connected: number }>
  }
  posts: {
    total: number
    byStatus: Record<string, number>
  }
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
  }, [])

  const loadStats = async () => {
    try {
      const response = await api.get('/api/admin/stats')
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
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Administration</p>
            <h1 className="text-3xl font-semibold text-primary">Admin Panel</h1>
            <p className="text-sm text-slate-500">Manage users, monitor platform activity, and oversee system operations.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-2">
            <Shield className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-semibold text-brand-600">Administrator</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Users</p>
                <p className="mt-3 text-4xl font-semibold text-primary">{stats?.users.total || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-purple-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Videos</p>
                <p className="mt-3 text-4xl font-semibold text-primary">{stats?.videos.total || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-green-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Social Accounts</p>
                <p className="mt-3 text-4xl font-semibold text-primary">{stats?.socialAccounts.total || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <Share2 className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-100/60 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Scheduled Posts</p>
                <p className="mt-3 text-4xl font-semibold text-primary">{stats?.posts.total || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-primary">Video Status Breakdown</h2>
            <div className="space-y-3">
              {stats?.videos.byStatus ? (
                Object.entries(stats.videos.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 capitalize">{status}</span>
                    <Badge variant="default">{count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No video data available</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-primary">Social Accounts by Platform</h2>
            <div className="space-y-3">
              {stats?.socialAccounts.byPlatform ? (
                Object.entries(stats.socialAccounts.byPlatform).map(([platform, data]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 capitalize">{platform}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{data.connected} connected</span>
                      <Badge variant="default">{data.total} total</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No social account data available</p>
              )}
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
                          <Badge variant="success" className="text-xs">Verified</Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">Unverified</Badge>
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

