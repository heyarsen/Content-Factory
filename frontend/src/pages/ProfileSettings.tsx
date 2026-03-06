import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../hooks/useToast'
import { User, Mail, LogOut } from 'lucide-react'
import api from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { CreditCard } from 'lucide-react'
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
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-6 sm:p-8 text-white shadow-[0_60px_120px_-70px_rgba(79,70,229,0.9)]">
          <div className="absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{t('preferences.account_settings_label')}</p>
              <h1 className="text-3xl font-semibold md:text-4xl">{t('preferences.profile_security_title')}</h1>
              <p className="text-sm text-white/80">{t('preferences.profile_security_desc')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/preferences">
                <Button className="w-full border border-white/20 bg-white/20 text-white backdrop-blur hover:bg-white/30 hover:text-white shadow-lg">
                  {t('preferences.go_to_workspace_preferences')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

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

        {/* Password Settings — hidden */}

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
