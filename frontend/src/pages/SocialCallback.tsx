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
    const code = searchParams.get('code')
    const platform = searchParams.get('platform')

    if (!code || !platform) {
      setError('Missing code or platform parameter')
      setLoading(false)
      return
    }

    const handleCallback = async () => {
      try {
        await api.post('/api/social/callback', { code, platform })
        navigate('/social')
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

