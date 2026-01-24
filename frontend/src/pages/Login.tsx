import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { LanguageSelector } from '../components/LanguageSelector'

export function Login() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [optimisticLoading, setOptimisticLoading] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setOptimisticLoading(true) // Immediate loading feedback

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (setLoading) {
        setLoading(false)
        setOptimisticLoading(false)
        setError(t('auth.server_error'))
        console.warn('[Login] Safety timeout triggered')
      }
    }, 35000)

    try {
      console.log('[Login] Attempting sign in...')
      await signIn(email, password)
      clearTimeout(safetyTimeout)
      setOptimisticLoading(false)
      navigate('/dashboard')
    } catch (err: any) {
      clearTimeout(safetyTimeout)
      setOptimisticLoading(false)
      console.error('Login error:', err)

      // Extract error message from various possible error formats
      let errorMessage = t('auth.login_failed')
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      } else if (err.request && !err.response) {
        errorMessage = t('auth.server_error')
      } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        errorMessage = t('auth.server_error')
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = t('auth.server_error')
      }

      // Handle 503 Service Unavailable (Supabase down or circuit breaker open)
      if (err.response?.status === 503) {
        const retryAfter = err.response?.data?.retryAfter || 30
        errorMessage = t('auth.retry_after', { retryAfter })
      } else if (err.response?.status === 401) {
        // Handle 401 Unauthorized (invalid credentials)
        errorMessage = t('auth.invalid_credentials')
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden flex-col justify-between rounded-[32px] border border-white/40 bg-white/80 p-10 shadow-[0_55px_120px_-70px_rgba(79,70,229,0.8)] backdrop-blur-xl lg:flex">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                NovaCreate
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-primary">{t('auth.login_title')}</h1>
              <p className="text-sm text-slate-500">
                {t('auth.login_subtitle')}
              </p>
            </div>
            <div className="grid gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
                {t('auth.feature_rendering')}
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                {t('auth.feature_distribution')}
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                {t('auth.feature_scripting')}
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden p-8 shadow-[0_45px_95px_-65px_rgba(15,23,42,0.7)]">
            <div className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-8 space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-md">
                  <span className="text-xl font-semibold">N</span>
                </div>
                <h2 className="text-2xl font-semibold text-primary">{t('auth.welcome_back')}</h2>
                <p className="text-sm text-slate-500">{t('auth.login_desc')}</p>
              </div>

              {/* Language Selector */}
              <div className="mb-6">
                <LanguageSelector showLabel={true} />
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  type="email"
                  id="email"
                  name="email"
                  label={t('auth.email_label')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <div className="relative w-full">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    label={t('auth.password_label')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[2.625rem] -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-brand-600 transition hover:text-brand-700"
                  >
                    {t('auth.forgot_password')}
                  </Link>
                </div>

                <Button type="submit" className="w-full" loading={loading || optimisticLoading}>
                  {t('auth.sign_in')}
                </Button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-slate-500">{t('auth.continue_with')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => signInWithGoogle()}
                  disabled={loading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  {t('auth.google')}
                </Button>
              </div>

              <p className="mt-8 text-center text-sm text-slate-500">
                {t('auth.no_account')}{' '}
                <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
                  {t('auth.create_one')}
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

