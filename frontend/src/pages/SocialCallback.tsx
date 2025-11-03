import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'

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
        await api.post('/api/social/callback', {
          platform: resolvedPlatform,
          uploadPostUsername,
        })

        localStorage.removeItem(`uploadpost_access_url_${resolvedPlatform}`)
        localStorage.removeItem(`uploadpost_username_${resolvedPlatform}`)
        localStorage.removeItem(`uploadpost_redirect_url_${resolvedPlatform}`)

        navigate(`/social?connected=${resolvedPlatform}`)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to connect account')
        setLoading(false)
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-primary mb-4">Connection Failed</h1>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/social')}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Social Accounts
          </button>
        </Card>
      </div>
    )
  }

  return null
}

