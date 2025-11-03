import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        {status === 'verifying' && (
          <>
            <h1 className="text-2xl font-bold text-primary mb-4">Verifying Email</h1>
            <p className="text-sm text-gray-600 mb-4">Please wait while we verify your email address...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-success mb-4">Email Verified!</h1>
            <p className="text-sm text-gray-600 mb-6">
              Your email has been successfully verified. Redirecting to dashboard...
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-error mb-4">Verification Failed</h1>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/login')} className="w-full">
                Go to Login
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/signup')}
                className="w-full"
              >
                Sign Up Again
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

