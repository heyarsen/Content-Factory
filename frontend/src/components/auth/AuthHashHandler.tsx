import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function AuthHashHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if there's an access_token in the hash (Supabase email verification redirects)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Extract the hash and redirect to verify-email with query params
      const hash = window.location.hash.substring(1)
      navigate(`/verify-email?${hash}`)
    }
  }, [navigate])

  return null
}

