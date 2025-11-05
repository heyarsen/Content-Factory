import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../hooks/useToast'
import { User, Lock, Mail, LogOut } from 'lucide-react'
import api from '../lib/api'

export function ProfileSettings() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [emailForm, setEmailForm] = useState({
    email: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.email) {
      setEmailForm({ email: user.email })
    }
  }, [user])

  const handleEmailUpdate = async () => {
    if (!emailForm.email || emailForm.email === user?.email) {
      toast.error('Please enter a new email address')
      return
    }

    setSaving(true)
    try {
      await api.patch('/api/auth/profile', {
        email: emailForm.email,
      })
      toast.success('Email update initiated. Please check your email to confirm.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update email')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password) {
      toast.error('Please fill in all password fields')
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      await api.patch('/api/auth/profile', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Password updated successfully')
      setPasswordForm({
        old_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Settings</p>
          <h1 className="text-3xl font-semibold text-primary">Profile Settings</h1>
          <p className="text-sm text-slate-500">
            Manage your account information and security settings.
          </p>
        </div>

        {/* Email Settings */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Mail className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Email Address</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="Current Email"
              type="email"
              value={emailForm.email}
              onChange={(e) => setEmailForm({ email: e.target.value })}
              placeholder="your@email.com"
            />
            <p className="text-xs text-slate-500">
              After changing your email, you'll receive a confirmation email at the new address.
            </p>
            <div className="flex justify-end">
              <Button onClick={handleEmailUpdate} loading={saving} disabled={emailForm.email === user?.email}>
                Update Email
              </Button>
            </div>
          </div>
        </Card>

        {/* Password Settings */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Lock className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Change Password</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
              placeholder="Enter current password"
            />
            <Input
              label="New Password"
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              placeholder="Enter new password"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              placeholder="Confirm new password"
            />
            <p className="text-xs text-slate-500">
              Password must be at least 6 characters long.
            </p>
            <div className="flex justify-end">
              <Button onClick={handlePasswordUpdate} loading={saving}>
                Update Password
              </Button>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <User className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Account Information</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-600">User ID</span>
              <span className="text-sm text-slate-500 font-mono">{user?.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <span className="text-sm text-slate-500">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-600">Email Verified</span>
              <span className="text-sm text-slate-500">
                {user?.email_confirmed_at ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </Card>

        {/* Logout */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <LogOut className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">Sign Out</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Sign out of your account. You'll need to sign in again to access your workspace.
            </p>
            <div className="flex justify-end">
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await signOut()
                    navigate('/login')
                  } catch (error) {
                    console.error('Sign out error:', error)
                    // Force navigation even if signOut fails
                    navigate('/login')
                  }
                }}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
