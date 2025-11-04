import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'

export function SocialCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const platform = searchParams.get('platform')
    const errorParam =
      searchParams.get('error') ||
      searchParams.get('message') ||
      searchParams.get('error_description')
    const statusParam = searchParams.get('status')

    if (!platform) {
      setError('Missing platform parameter')
      setLoading(false)
      return
    }

    if (statusParam === 'cancelled') {
      setError('The connection was cancelled. Please try again if you still want to link your account.')
      setLoading(false)
      return
    }

    if (errorParam) {
      setError(errorParam)
      setLoading(false)
      return
    }

    const resolvedPlatform = platform as string

    const usernameParam =
      searchParams.get('uploadpost_username') ||
      searchParams.get('username') ||
      searchParams.get('user') ||
      searchParams.get('user_id') ||
      searchParams.get('profile')

    const storedUsername = localStorage.getItem(`uploadpost_username_${resolvedPlatform}`)
    const uploadPostUsername = usernameParam || storedUsername

    if (!uploadPostUsername) {
      setError('Missing Upload-Post username. Please restart the connection flow.')
      setLoading(false)
      return
    }

    const handleCallback = async () => {
      try {
        const response = await api.post('/api/social/callback', {
          platform: resolvedPlatform,
          uploadPostUsername,
        })

        // Only navigate to success if we got a successful response
        if (response.status === 200 || response.status === 201) {
          localStorage.removeItem(`uploadpost_access_url_${resolvedPlatform}`)
          localStorage.removeItem(`uploadpost_username_${resolvedPlatform}`)
          localStorage.removeItem(`uploadpost_redirect_url_${resolvedPlatform}`)

          navigate(`/social?connected=${resolvedPlatform}`)
        } else {
          setError('Connection verification failed. Please try again.')
          setLoading(false)
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to connect account'
        setError(errorMessage)
        setLoading(false)
        // Don't navigate - show error instead
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <Card className="w-full max-w-lg p-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-500">Connecting your account. You will be redirected shortly.</p>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-rose-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <Card className="w-full max-w-lg p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-brand-500 text-white shadow-md">
              <span className="text-xl font-semibold">!</span>
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-primary">Connection failed</h1>
            <p className="mt-3 text-sm text-slate-500">{error}</p>
            <Button onClick={() => navigate('/social')} className="mt-8 w-full">
              Back to social accounts
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return null
}

