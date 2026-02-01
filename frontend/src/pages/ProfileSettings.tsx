import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../hooks/useToast'
import { User, Lock, Mail, LogOut } from 'lucide-react'
import api from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { Sparkles, CreditCard } from 'lucide-react'
import { useCreditsContext } from '../contexts/CreditContext'
import { CreditBanner } from '../components/ui/CreditBanner'

export function ProfileSettings() {
  const { user, signOut } = useAuth()
  const { credits, unlimited } = useCreditsContext()
  const { toast } = useToast()
  const { t } = useLanguage()

  const hasSubscription = !!(user?.hasActiveSubscription || user?.role === 'admin')
  const safeCanCreate = hasSubscription || (credits !== null && credits > 0) || unlimited
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
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user?.email) {
      setEmailForm({ email: user.email })
    }
  }, [user])

  const handleEmailUpdate = async () => {
    if (!emailForm.email || emailForm.email === user?.email) {
      toast.error(t('preferences.new_email_required'))
      return
    }

    setSaving(true)
    try {
      await api.patch('/api/auth/profile', {
        email: emailForm.email,
      })
      toast.success(t('preferences.email_update_initiated'))
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('preferences.email_update_failed'))
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password) {
      toast.error(t('preferences.fill_all_fields'))
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(t('preferences.passwords_not_match'))
      return
    }

    if (passwordForm.new_password.length < 6) {
      toast.error(t('preferences.password_too_short'))
      return
    }

    setSaving(true)
    try {
      await api.patch('/api/auth/profile', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      toast.success(t('preferences.password_updated'))
      setPasswordForm({
        old_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('preferences.password_update_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(t('preferences.delete_account_confirm'))
    if (!confirmed) return

    setDeleting(true)
    try {
      await api.delete('/api/auth/account')
      toast.success(t('preferences.account_deleted'))
      await signOut()
      navigate('/login')
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('profile_settings.account_delete_failed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('common.settings')}</p>
          <h1 className="text-3xl font-semibold text-primary">{t('preferences.profile_settings')}</h1>
          <p className="text-sm text-slate-500">
            {t('preferences.profile_settings_desc')}
          </p>
        </div>

        {/* Email Settings */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Mail className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.email_address')}</h2>
          </div>
          <div className="space-y-4">
            <Input
              label={t('preferences.current_email')}
              type="email"
              value={emailForm.email}
              onChange={(e) => setEmailForm({ email: e.target.value })}
              placeholder="your@email.com"
            />
            <p className="text-xs text-slate-500">
              {t('preferences.email_change_note')}
            </p>
            <div className="flex justify-end">
              <Button onClick={handleEmailUpdate} loading={saving} disabled={emailForm.email === user?.email} className="w-full sm:w-auto">
                {t('preferences.update_email')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Password Settings */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <Lock className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.change_password')}</h2>
          </div>
          <div className="space-y-4">
            <Input
              label={t('preferences.current_password')}
              type="password"
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
              placeholder={t('profile_settings.current_password_placeholder')}
            />
            <Input
              label={t('preferences.new_password')}
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              placeholder={t('profile_settings.new_password_placeholder')}
            />
            <Input
              label={t('preferences.confirm_new_password')}
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              placeholder={t('profile_settings.confirm_password_placeholder')}
            />
            <p className="text-xs text-slate-500">
              {t('preferences.password_requirement')}
            </p>
            <div className="flex justify-end">
              <Button onClick={handlePasswordUpdate} loading={saving} className="w-full sm:w-auto">
                {t('preferences.update_password')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <User className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.account_information')}</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-600">{t('preferences.user_id')}</span>
              <span className="text-sm text-slate-500 font-mono">{user?.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-600">{t('common.email')}</span>
              <span className="text-sm text-slate-500">{user?.email}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-600">{t('preferences.email_verified')}</span>
              <span className="text-sm text-slate-500">
                {user?.email_confirmed_at ? t('preferences.yes') : t('preferences.no')}
              </span>
            </div>
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Subscription Status</span>
                </div>
                <Badge variant={safeCanCreate ? 'success' : 'warning'}>
                  {safeCanCreate ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CreditBanner />
            </div>
          </div>
        </Card>

        {/* Logout */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <LogOut className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-primary">{t('preferences.sign_out')}</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('preferences.sign_out_desc')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await signOut()
                  } catch (error) {
                    console.error('Sign out error:', error)
                  }
                  // Always navigate to login, regardless of errors
                  navigate('/login')
                }}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                {t('preferences.sign_out')}
              </Button>
              <Button
                variant="secondary"
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={handleDeleteAccount}
                loading={deleting}
              >
                {t('preferences.delete_account')}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              {t('preferences.delete_account_desc')}
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
