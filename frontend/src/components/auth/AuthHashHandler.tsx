import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function AuthHashHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if there's an access_token in the hash (Supabase email verification redirects)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Extract the hash
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const type = params.get('type')

      // Only redirect if it's explicitly a signup or recovery flow
      // Google OAuth redirects also include access_token but don't have these types
      if (type === 'signup' || type === 'recovery' || type === 'invite') {
        navigate(`/verify-email?${hash}`)
      }
    }
  }, [navigate])

  return null
}

