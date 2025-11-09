import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Eye, EyeOff } from 'lucide-react'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      // Extract error message from various possible error formats
      let errorMessage = 'Failed to sign in'
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.message) {
        errorMessage = err.message
      } else if (err.request && !err.response) {
        errorMessage = 'Unable to connect to server. Please check your connection.'
      }
      setError(errorMessage)
      // Don't clear password on error - keep it so user can see what they typed
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
              <h1 className="text-4xl font-semibold leading-tight text-primary">The modern studio for teams shipping video at scale.</h1>
              <p className="text-sm text-slate-500">
                Automate production, approvals, and distribution without sacrificing craft. Your audience experiences
                cohesive storytelling every time.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
                Real-time rendering progress across every workflow
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Instant distribution to every connected channel
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                AI-assisted scripting that still sounds on-brand
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
                <h2 className="text-2xl font-semibold text-primary">Welcome back</h2>
                <p className="text-sm text-slate-500">Log in to orchestrate your next campaign.</p>
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
                  label="Work email"
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
                    label="Password"
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-brand-600 transition hover:text-brand-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" loading={loading}>
                  Sign in
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
                  Create one
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

