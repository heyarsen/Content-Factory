import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import api from '../lib/api'

export function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [err, setErr] = useState<any>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setResending(true)
    setError('')
    try {
      await api.post('/api/auth/verify-email', { email })
      setSuccess(true)
    } catch (resendErr: any) {
      setError(resendErr.response?.data?.error || 'Failed to resend verification email')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password)
      setSuccess(true)
      setErr(null)
    } catch (signupErr: any) {
      setErr(signupErr)
      setError(signupErr.response?.data?.error || signupErr.response?.data?.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <Card className="w-full max-w-lg p-10 text-center shadow-[0_45px_95px_-65px_rgba(15,23,42,0.7)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-brand-500 text-white shadow-md">
              <span className="text-xl font-semibold">?</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-primary">Check your inbox</h1>
            <p className="mt-3 text-sm text-slate-500">
              We just sent a verification email to <span className="font-semibold text-primary">{email}</span>. Click the link to confirm your account and start shipping content.
            </p>
            <Button onClick={() => navigate('/login')} className="mt-8 w-full">
              Back to sign in
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-pink-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="hidden flex-col justify-between rounded-[32px] border border-white/40 bg-white/80 p-10 shadow-[0_55px_120px_-70px_rgba(79,70,229,0.8)] backdrop-blur-xl lg:flex">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Join the studio
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-primary">Build a resilient content engine together.</h1>
              <p className="text-sm text-slate-500">
                Collaborate with your team, templatize your best work, and automate the heavy lifting so you can focus on what matters.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
                Collaborative workspaces with creative guardrails
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                Smart scheduling that respects channel algorithms
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Built-in compliance and approvals for enterprise-ready teams
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
                <h2 className="text-2xl font-semibold text-primary">Create your account</h2>
                <p className="text-sm text-slate-500">Invite your team, align your content, and automate delivery.</p>
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                  {error}
                  {err?.response?.data?.canLogin && (
                    <div className="mt-3 space-y-1 text-left">
                      <Link
                        to="/login"
                        className="inline-flex items-center text-sm font-semibold text-brand-600 underline hover:text-brand-700"
                      >
                        Try logging in instead
                      </Link>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resending}
                        className="block text-left text-sm font-semibold text-brand-600 underline hover:text-brand-700 disabled:opacity-60"
                      >
                        {resending ? 'Sending?' : 'Resend verification email'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  type="email"
                  label="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Input
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  Create account
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-slate-500">
                Already onboarded?{' '}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign in
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

