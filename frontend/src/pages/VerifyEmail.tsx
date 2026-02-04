import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LegalFooter } from '../components/layout/LegalFooter'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyEmail = async () => {
      // Check URL params first
      let accessToken = searchParams.get('access_token')
      let refreshToken = searchParams.get('refresh_token')
      
      // If not in params, check hash fragment (Supabase sometimes redirects with hash)
      if (!accessToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        accessToken = hashParams.get('access_token')
        refreshToken = hashParams.get('refresh_token')
      }

      if (!accessToken) {
        setStatus('error')
        setError('Missing verification token')
        return
      }

      try {
        // Set the session with the token from the URL
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })

        if (sessionError) {
          throw sessionError
        }

        if (data.session) {
          localStorage.setItem('access_token', data.session.access_token)
          setStatus('success')
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/dashboard')
          }, 2000)
        } else {
          throw new Error('Failed to create session')
        }
      } catch (err: any) {
        console.error('Verification error:', err)
        setStatus('error')
        setError(err.message || 'Failed to verify email')
      }
    }

    verifyEmail()
  }, [searchParams, navigate])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <Card className="w-full max-w-lg p-10 text-center shadow-[0_45px_95px_-65px_rgba(15,23,42,0.7)]">
          {status === 'verifying' && (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-md">
                <span className="text-xl font-semibold">N</span>
              </div>
              <h1 className="text-2xl font-semibold text-primary">Verifying your email</h1>
              <p className="text-sm text-slate-500">
                Hang tight while we confirm your access. This should only take a moment.
              </p>
              <div className="flex justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-transparent" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-brand-500 text-white shadow-md">
                <span className="text-xl font-semibold">?</span>
              </div>
              <h1 className="text-2xl font-semibold text-primary">Email verified</h1>
              <p className="text-sm text-slate-500">
                Your workspace is ready. We&apos;re redirecting you to the dashboard now.
              </p>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to dashboard
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-brand-500 text-white shadow-md">
                <span className="text-xl font-semibold">!</span>
              </div>
              <h1 className="text-2xl font-semibold text-error">Verification failed</h1>
              <p className="text-sm text-slate-500">{error}</p>
              <div className="space-y-3">
                <Button onClick={() => navigate('/login')} className="w-full">
                  Go to sign in
                </Button>
                <Button
                  variant="ghost"
                  className="w-full border border-white/60 bg-white/70 text-slate-500 hover:border-brand-200 hover:text-brand-600"
                  onClick={() => navigate('/signup')}
                >
                  Create a new account
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      <LegalFooter className="bg-transparent" />
    </div>
  )
}
