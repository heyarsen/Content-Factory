import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const accessToken = searchParams.get('access_token')

  useEffect(() => {
    if (!accessToken) {
      setError('Invalid reset token')
    }
  }, [accessToken])

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

    if (!accessToken) {
      setError('Invalid reset token')
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
      setError(err.response?.data?.error || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-primary mb-4">Password reset successful</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Go to sign in
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-6">Reset password</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}

