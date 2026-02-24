import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LegalFooter } from '../components/layout/LegalFooter'
import { useLanguage } from '../contexts/LanguageContext'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const accessToken = searchParams.get('access_token')

  useEffect(() => {
    if (!accessToken) {
      setError(t('auth.invalid_reset_token'))
    }
  }, [accessToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('auth.passwords_not_match'))
      return
    }

    if (password.length < 6) {
      setError(t('auth.password_too_short'))
      return
    }

    if (!accessToken) {
      setError(t('auth.invalid_reset_token'))
      return
    }

    setLoading(true)

    try {
      await api.post('/api/auth/reset-password/confirm', {
        password,
        access_token: accessToken,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.reset_password_failed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <Card className="w-full max-w-lg p-10 text-center shadow-[0_45px_95px_-65px_rgba(15,23,42,0.7)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-brand-500 text-white shadow-md">
              <span className="text-xl font-semibold">?</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-primary">{t('auth.password_updated_title')}</h1>
            <p className="mt-3 text-sm text-slate-500">
              {t('auth.password_updated_desc')}
            </p>
            <Button onClick={() => navigate('/login')} className="mt-8 w-full">
              {t('auth.continue_to_sign_in')}
            </Button>
          </Card>
        </div>
        <LegalFooter className="bg-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <Card className="w-full max-w-lg p-8 shadow-[0_45px_95px_-65px_rgba(15,23,42,0.7)]">
          <div className="mb-8 space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-md">
              <span className="text-xl font-semibold">N</span>
            </div>
            <h1 className="text-2xl font-semibold text-primary">{t('auth.choose_new_password')}</h1>
            <p className="text-sm text-slate-500">{t('auth.choose_new_password_desc')}</p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              type="password"
              id="password"
              name="password"
              label={t('auth.new_password_label')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              label={t('auth.confirm_password_label')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" loading={loading}>
              {t('auth.reset_password_button')}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              {t('auth.back_to_sign_in')}
            </Link>
          </p>
        </Card>
      </div>
      <LegalFooter className="bg-transparent" />
    </div>
  )
}
